"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import CourseExamStatus from "@/components/CourseExamStatus";
import { Icon } from "@/components/Icon";
import { Alert, CompletionBar, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { OverallProgress, StudyPlan, Subject } from "@/lib/types";

export default function CoursesPage() {
  const { user, setUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [progressBySubject, setProgressBySubject] = useState<Record<string, OverallProgress>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const router = useRouter();

  const loadCourses = useCallback(async () => {
    try {
      const list = await api.getSubjects();
      setSubjects(list);
      const inPlan = list.filter((subject) => subject.in_plan);
      const progress = await Promise.all(inPlan.map((subject) => api.getProgress(subject.slug)));
      setProgressBySubject(Object.fromEntries(progress.map((item) => [item.subject_slug, item])));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    api
      .getStudyPlan()
      .then(setStudyPlan)
      .catch(() => setStudyPlan(null));
  }, []);

  async function changePlan(slug: string, action: () => Promise<typeof user>) {
    setBusySlug(slug);
    setError(null);
    try {
      const updated = await action();
      if (updated) setUser(updated);
      await loadCourses();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusySlug(null);
    }
  }

  const planSize = subjects?.filter((subject) => subject.in_plan).length ?? 0;
  const studyPlanCourses = studyPlan?.strategy.courses.map((course) => course.subject_slug) ?? [];

  async function removeCourse(slug: string, name: string) {
    const inStudyPlan = studyPlanCourses.includes(slug);
    const warning = inStudyPlan
      ? `${name} is part of your study plan. Removing it also takes it out of the plan: ` +
        (studyPlanCourses.length === 1
          ? "it's the plan's only course, so the plan ends. Your progress is kept."
          : "you'll review the updated plan next. Your progress is kept.")
      : `Remove ${name} from My courses? Your progress is kept.`;
    if (!window.confirm(warning)) return;
    await changePlan(slug, () => api.removeSubjectFromPlan(slug));
    if (!inStudyPlan) return;
    if (studyPlanCourses.length === 1) {
      await api.deleteStudyPlan();
      setStudyPlan(null);
    } else {
      router.push(`/study-plan?remove=${slug}`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        icon="book"
        title="My courses"
        description="The courses in your learning plan. Switch between them here or from the course menu at the top."
        actions={
          <Link href="/explore" className="btn btn-secondary">
            Browse all courses
          </Link>
        }
      />

      {error && <Alert>{error}</Alert>}
      {!subjects && !error && <Spinner />}

      {subjects && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Only courses in the plan; the full catalogue is on the Courses page. */}
          {subjects.filter((subject) => subject.in_plan).map((subject) => {
            const progress = progressBySubject[subject.slug];
            const busy = busySlug === subject.slug;
            return (
              <article
                key={subject.slug}
                className={`panel flex flex-col gap-4 p-5 sm:p-6 ${subject.current ? "border-violet/50 ring-2 ring-violet/15" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <span aria-hidden className={`icon-tile h-12 w-12 shrink-0 ${subject.current ? "bg-brand" : "bg-violet-tint text-violet"}`}>
                    <Icon name={subject.language === "javascript" ? "bolt" : "code"} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold">{subject.name}</h2>
                    <p className="text-sm text-ink-soft">{subject.topic_count} topics</p>
                  </div>
                  {subject.current ? (
                    <span className="rounded-full bg-violet-tint px-2.5 py-0.5 text-xs font-bold text-violet">Current course</span>
                  ) : null}
                </div>
                {studyPlan && (
                  <p className="-mt-2 text-xs font-bold">
                    {studyPlanCourses.includes(subject.slug) ? (
                      <span className="text-blue-deep">📅 In your study plan</span>
                    ) : (
                      <span className="text-ink-soft">On its own (not in your study plan)</span>
                    )}
                  </p>
                )}
                <p className="text-ink-soft">{subject.description}</p>

                {progress && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <CompletionBar percent={progress.completion_percent} label={`${subject.name} completion`} />
                      <p className="text-xs text-ink-soft">
                        {progress.completion_percent}% complete · {progress.topics_completed} of {progress.topics.length}{" "}
                        topics complete
                      </p>
                    </div>
                    <CourseExamStatus progress={progress} compact />
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-2">
                  {subject.in_plan && !subject.current && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => changePlan(subject.slug, () => api.setCurrentSubject(subject.slug))}
                    >
                      Switch to {subject.name}
                    </button>
                  )}
                  {subject.current && (
                    <Link href="/dashboard" className="btn btn-primary">
                      Continue learning
                    </Link>
                  )}
                  {studyPlan && !studyPlanCourses.includes(subject.slug) && (
                    <Link href={`/study-plan?add=${subject.slug}`} className="btn btn-secondary">
                      Add to study plan
                    </Link>
                  )}
                  {studyPlanCourses.includes(subject.slug) && studyPlanCourses.length > 1 && (
                    <Link href={`/study-plan?remove=${subject.slug}`} className="btn btn-secondary">
                      Take out of study plan
                    </Link>
                  )}
                  {subject.in_plan && planSize > 1 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => removeCourse(subject.slug, subject.name)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-sm text-ink-soft">
        Removing a course from your plan keeps your progress. Add it again from Courses any time to pick up where
        you left off.
      </p>
    </div>
  );
}