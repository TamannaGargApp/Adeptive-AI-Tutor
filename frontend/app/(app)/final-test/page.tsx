"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import Countdown from "@/components/Countdown";
import CourseExamStatus from "@/components/CourseExamStatus";
import FinalTestResults from "@/components/FinalTestResults";
import FinalTestRunner from "@/components/FinalTestRunner";
import { Alert, Spinner } from "@/components/ui";
import WaitingMessage from "@/components/WaitingMessage";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGamification } from "@/lib/gamification";
import { courseExamLink, FAILS_BEFORE_COOLDOWN, finalTestLink, RETRY_COOLDOWN_HOURS } from "@/lib/labels";
import type { FinalTest, OverallProgress, Subject, Topic, TopicProgress } from "@/lib/types";

// Must match final_test_service.py and progress_service.py on the backend.
const TOPIC_TEST_LENGTH = 10;
const COURSE_EXAM_QUESTIONS_PER_TOPIC = 2;
const SECONDS_PER_QUESTION = 90;
const PASS_MARK = 70;

function minutes(questionCount: number): number {
  return Math.round((questionCount * SECONDS_PER_QUESTION) / 60);
}

function FinalTestPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const topicSlug = searchParams.get("topic");
  const courseSlug = searchParams.get("course");
  const testId = searchParams.get("test");

  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courseProgress, setCourseProgress] = useState<OverallProgress | null>(null);
  // Bumped when a test finishes, so completion and attempts-left are reloaded.
  const [progressVersion, setProgressVersion] = useState(0);
  const [test, setTest] = useState<FinalTest | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedTestRef = useRef<string | null>(null);

  // Topics of the course being viewed: the one in the URL for a course exam, otherwise the current course.
  useEffect(() => {
    setTopics(null);
    setCourseProgress(null);
    Promise.all([api.getTopics(courseSlug ?? undefined), api.getProgress(courseSlug ?? undefined)])
      .then(([topicList, progress]) => {
        setTopics(topicList);
        setCourseProgress(progress);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [courseSlug, user?.current_subject, progressVersion]);

  useEffect(() => {
    api
      .getSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  // Resume a test from the URL, e.g. after a page refresh.
  useEffect(() => {
    if (!testId || loadedTestRef.current === testId) return;
    loadedTestRef.current = testId;
    setError(null);
    api
      .getFinalTest(testId)
      .then(setTest)
      .catch((err) => setError(errorMessage(err)));
  }, [testId]);

  async function startTest(start: () => Promise<FinalTest>) {
    setStarting(true);
    setError(null);
    try {
      const created = await start();
      loadedTestRef.current = created.id;
      setTest(created);
      router.replace(`/final-test?test=${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const { refresh: refreshGamification } = useGamification();
  const reloadProgress = useCallback(() => setProgressVersion((version) => version + 1), []);
  const handleFinished = useCallback(
    (finished: FinalTest) => {
      setTest(finished);
      setProgressVersion((version) => version + 1);
      refreshGamification();
    },
    [refreshGamification],
  );

  function retake() {
    if (!test) return;
    const next =
      test.scope === "course" || !test.topic_slug ? courseExamLink(test.subject_slug) : finalTestLink(test.topic_slug);
    setTest(null);
    loadedTestRef.current = null;
    router.replace(next);
  }

  const topic = topics?.find((item) => item.slug === topicSlug);
  const currentCourse = subjects.find((item) => item.slug === (courseSlug ?? user?.current_subject));

  let content: React.ReactNode;
  if (testId && test && test.id === testId) {
    if (!test.submitted) {
      content = <FinalTestRunner test={test} onFinished={handleFinished} />;
    } else if (test.result) {
      const best =
        test.scope === "course"
          ? (courseProgress?.course_exam_best ?? null)
          : (courseProgress?.topics.find((item) => item.topic_slug === test.topic_slug)?.final_test_best ?? null);
      content = <FinalTestResults test={test} result={test.result} best={best} onRetake={retake} />;
    } else {
      content = <Alert>Your answers were submitted, but the results aren&apos;t ready. Refresh the page to try again.</Alert>;
    }
  } else if (testId) {
    content = error ? null : <Spinner label="Loading your test…" />;
  } else if (starting) {
    content = (
      <WaitingMessage
        label={courseSlug ? "Writing your course exam. This can take a little while…" : "Writing your final test. This can take a few seconds…"}
      />
    );
  } else if (!topics) {
    content = error ? null : <Spinner />;
  } else if (courseSlug && currentCourse && courseProgress) {
    content = (
      <CourseExamIntro
        course={currentCourse}
        progress={courseProgress}
        topicCount={topics.length}
        onStart={() => startTest(() => api.startCourseExam(currentCourse.slug))}
        onUnlock={reloadProgress}
      />
    );
  } else if (topic) {
    content = (
      <TopicTestIntro
        topic={topic}
        progress={courseProgress?.topics.find((item) => item.topic_slug === topic.slug) ?? null}
        onStart={() => startTest(() => api.startTopicTest(topic.slug))}
        onUnlock={reloadProgress}
      />
    );
  } else if (!courseSlug) {
    content = (
      <TestPicker
        topics={topics}
        course={currentCourse}
        progress={courseProgress}
        onPickTopic={(slug) => router.replace(finalTestLink(slug))}
      />
    );
  } else {
    content = <Spinner />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {error && <Alert>{error}</Alert>}
      {content}
    </div>
  );
}

function TestPicker({
  topics,
  course,
  progress,
  onPickTopic,
}: {
  topics: Topic[];
  course: Subject | undefined;
  progress: OverallProgress | null;
  onPickTopic: (slug: string) => void;
}) {
  const examQuestions = topics.length * COURSE_EXAM_QUESTIONS_PER_TOPIC;
  const progressBySlug = new Map(progress?.topics.map((item) => [item.topic_slug, item]));
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Final tests</h1>
        <p className="mt-2 text-ink-soft">Timed tests with answers revealed only at the end.</p>
      </div>

      {course && progress && !progress.course_exam_unlocked && (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">{course.name} course exam</h2>
          <CourseExamStatus progress={progress} />
        </div>
      )}

      {course && progress?.course_exam_unlocked && (
        <Link
          href={courseExamLink(course.slug)}
          className="block rounded-xl border-2 border-sun bg-sun-tint p-5 hover:border-blue"
        >
          <span className="text-sm font-bold text-ink-soft">Course exam</span>
          <span className="mt-1 block text-2xl font-bold">{course.name} course exam</span>
          <span className="mt-1 block text-ink">
            {examQuestions} questions across all {topics.length} topics ·{" "}
            {minutes(examQuestions)} minutes
            {progress.course_exam_passed ? " · ✓ Completed" : ""}
            {progress.course_exam_best !== null ? ` · Best ${progress.course_exam_best}%` : ""}
            {progress.course_exam_locked_until && (
              <>
                {" · Retake in "}
                <Countdown until={progress.course_exam_locked_until} />
              </>
            )}
          </span>
        </Link>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">Topic tests</h2>
        <ul className="panel divide-y divide-line">
          {topics.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => onPickTopic(item.slug)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{item.name}</span>
                  <span className="text-sm text-ink-soft">{item.description}</span>
                </span>
                <TopicTestStatus progress={progressBySlug.get(item.slug)} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Status pill for a topic in the test list: completed, locked, or best score so far. */
function TopicTestStatus({ progress }: { progress: TopicProgress | undefined }) {
  if (!progress) return null;
  const pill = "shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";
  if (progress.final_test_passed) {
    return (
      <span className={`${pill} bg-good-tint text-good`}>
        ✓ Completed{progress.final_test_best !== null ? ` · Best ${progress.final_test_best}%` : ""}
      </span>
    );
  }
  if (progress.final_test_locked_until) {
    return (
      <span className={`${pill} bg-bad-tint text-bad`}>
        Locked · <Countdown until={progress.final_test_locked_until} />
      </span>
    );
  }
  if (progress.final_test_best !== null) {
    return <span className={`${pill} border border-line text-ink-soft`}>Best {progress.final_test_best}%</span>;
  }
  return null;
}

function TestRules({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {children}
      <li>Move freely between questions, mark any of them for review, and change answers until you submit.</li>
      <li>Answers and explanations are revealed only after you submit, with a full analysis.</li>
      <li>Answers are saved as you go. The test submits automatically when time runs out.</li>
      <li>Unanswered questions count as incorrect, and results count toward your topic progress.</li>
      <li>You need {PASS_MARK}% or more to pass. Anything below is a fail.</li>
    </ul>
  );
}

function CompletedNotice({ best, children }: { best: number | null; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-good bg-good-tint px-4 py-3" role="status">
      <p className="font-bold text-good">✓ Completed</p>
      <p className="text-ink">
        You passed this test{best !== null ? ` with a best score of ${best}%` : ""}.
      </p>
      {children}
    </div>
  );
}

function BestScore({ best }: { best: number | null }) {
  if (best === null) return null;
  return (
    <p className="text-sm">
      <span className="text-ink-soft">Your best score: </span>
      <span className="font-bold">{best}%</span>
    </p>
  );
}

function LockedNotice({ until, onUnlock, children }: { until: string; onUnlock: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-4 border-bad bg-bad-tint px-4 py-3" role="status">
      <p className="font-bold text-bad">Locked for now</p>
      <p className="text-ink">{children}</p>
      <p className="mt-1 text-ink">
        Next attempt in <Countdown until={until} onDone={onUnlock} />
      </p>
    </div>
  );
}

function TopicTestIntro({
  topic,
  progress,
  onStart,
  onUnlock,
}: {
  topic: Topic;
  progress: TopicProgress | null;
  onStart: () => void;
  onUnlock: () => void;
}) {
  const attemptsLeft = progress?.final_test_attempts_left ?? null;
  const passed = Boolean(progress?.final_test_passed);
  const lockedUntil = progress?.final_test_locked_until ?? null;
  const failsInRow = progress?.final_test_fails_in_row ?? 0;
  return (
    <div className="panel space-y-5 p-6">
      <div>
        <p className="text-sm font-bold text-ink-soft">Topic test</p>
        <h1 className="text-3xl font-bold">{topic.name}</h1>
      </div>
      {passed && (
        <CompletedNotice best={progress?.final_test_best ?? null}>
          <p className="mt-1 text-sm text-ink">
            {attemptsLeft
              ? `You can take ${attemptsLeft} more new attempt${attemptsLeft === 1 ? "" : "s"}. Your best score is kept, so a new attempt can't undo your completion.`
              : "You've used all your new attempts for this test."}
          </p>
        </CompletedNotice>
      )}
      {!passed && <BestScore best={progress?.final_test_best ?? null} />}
      {lockedUntil && (
        <LockedNotice until={lockedUntil} onUnlock={onUnlock}>
          You failed {FAILS_BEFORE_COOLDOWN} attempts in a row. Review the topic in Learn and Practice while you wait.
        </LockedNotice>
      )}
      {!lockedUntil && !passed && failsInRow > 0 && (
        <p className="rounded-lg border-l-4 border-sun bg-sun-tint px-4 py-3 text-sm">
          {failsInRow} of {FAILS_BEFORE_COOLDOWN} failed attempts in a row.{" "}
          {FAILS_BEFORE_COOLDOWN - failsInRow} more will lock this test for {RETRY_COOLDOWN_HOURS} hours.
        </p>
      )}
      <TestRules>
        <li>{TOPIC_TEST_LENGTH} questions covering every key concept in this topic.</li>
        <li>Passing it is required to complete the topic.</li>
        <li>
          {FAILS_BEFORE_COOLDOWN} failed attempts in a row lock the test for {RETRY_COOLDOWN_HOURS} hours.
        </li>
        <li>
          {minutes(TOPIC_TEST_LENGTH)} minutes. The timer starts as soon as the questions appear.
        </li>
      </TestRules>
      <div className="flex flex-wrap gap-3">
        {!lockedUntil && (!passed || (attemptsLeft ?? 0) > 0) && (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            {passed ? `Start new attempt (${attemptsLeft} left)` : "Start final test"}
          </button>
        )}
        <Link href="/final-test" className="btn btn-secondary">
          Choose another test
        </Link>
      </div>
    </div>
  );
}

function CourseExamIntro({
  course,
  progress,
  topicCount,
  onStart,
  onUnlock,
}: {
  course: Subject;
  progress: OverallProgress;
  topicCount: number;
  onStart: () => void;
  onUnlock: () => void;
}) {
  const questions = topicCount * COURSE_EXAM_QUESTIONS_PER_TOPIC;
  if (progress.course_exam_passed) {
    return (
      <div className="panel space-y-5 p-6">
        <div>
          <p className="text-sm font-bold text-ink-soft">Course exam</p>
          <h1 className="text-3xl font-bold">{course.name}</h1>
        </div>
        <CompletedNotice best={progress.course_exam_best}>
          <p className="mt-1 text-sm text-ink">The {course.name} course is complete. Well done!</p>
        </CompletedNotice>
        <div className="flex flex-wrap gap-3">
          <Link href="/achievements" className="btn btn-primary">
            See your achievements
          </Link>
          <Link href="/courses" className="btn btn-secondary">
            Explore other courses
          </Link>
        </div>
      </div>
    );
  }
  if (!progress.course_exam_unlocked) {
    return (
      <div className="panel space-y-5 p-6">
        <div>
          <p className="text-sm font-bold text-ink-soft">Course exam</p>
          <h1 className="text-3xl font-bold">{course.name}</h1>
        </div>
        <CourseExamStatus progress={progress} />
        <div className="flex flex-wrap gap-3">
          <Link href="/progress" className="btn btn-primary">
            See what&apos;s left
          </Link>
          <Link href="/final-test" className="btn btn-secondary">
            Choose another test
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="panel space-y-5 p-6">
      <div>
        <p className="text-sm font-bold text-ink-soft">Course exam</p>
        <h1 className="text-3xl font-bold">{course.name}</h1>
      </div>
      <p className="text-ink-soft">
        The final check for the whole course. Pass it with {PASS_MARK}% or more to complete the course.
      </p>
      <BestScore best={progress.course_exam_best} />
      {progress.course_exam_locked_until && (
        <LockedNotice until={progress.course_exam_locked_until} onUnlock={onUnlock}>
          Your last attempt didn&apos;t pass. Review your weaker topics while you wait.
        </LockedNotice>
      )}
      <TestRules>
        <li>
          {questions} questions: {COURSE_EXAM_QUESTIONS_PER_TOPIC} from each of the {topicCount} topics.
        </li>
        <li>
          {minutes(questions)} minutes. The timer starts as soon as the questions appear.
        </li>
        <li>Your results are broken down by topic, so you can see which topics to revisit.</li>
        <li>After a failed attempt, you can retake the exam {RETRY_COOLDOWN_HOURS} hours later.</li>
      </TestRules>
      <div className="flex flex-wrap gap-3">
        {!progress.course_exam_locked_until && (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Start course exam
          </button>
        )}
        <Link href="/final-test" className="btn btn-secondary">
          Choose another test
        </Link>
      </div>
    </div>
  );
}

export default function FinalTestPage() {
  return (
    <Suspense>
      <FinalTestPageContent />
    </Suspense>
  );
}