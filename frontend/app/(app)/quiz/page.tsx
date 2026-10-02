"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import QuizQuestion from "@/components/QuizQuestion";
import RecommendationCard from "@/components/RecommendationCard";
import { Alert, Spinner } from "@/components/ui";
import WaitingMessage from "@/components/WaitingMessage";
import { api, errorMessage } from "@/lib/api";
import { studyLink } from "@/lib/labels";
import type { EvaluationResult, Quiz, QuizResult, Topic } from "@/lib/types";

type Phase = "intro" | "generating" | "answering" | "finishing" | "result";

function QuizRunner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topicSlug = searchParams.get("topic");

  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTopics()
      .then(setTopics)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    // Picking another topic from the URL starts over.
    setPhase("intro");
    setQuiz(null);
    setResult(null);
    setError(null);
  }, [topicSlug]);

  const topic = topics?.find((item) => item.slug === topicSlug);
  const question = quiz?.questions[index];
  const isLastQuestion = quiz !== null && index === quiz.questions.length - 1;

  async function startQuiz() {
    if (!topicSlug) return;
    setError(null);
    setPhase("generating");
    try {
      const session = await api.createSession(topicSlug, "quiz");
      setQuiz(await api.createQuiz(session.id));
      setIndex(0);
      setAnswer("");
      setEvaluation(null);
      setPhase("answering");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("intro");
    }
  }

  async function submitAnswer() {
    if (!question) return;
    setSubmitting(true);
    setError(null);
    try {
      setEvaluation(await api.evaluate(question.id, answer));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function goToNext() {
    if (!quiz) return;
    if (!isLastQuestion) {
      setIndex(index + 1);
      setAnswer("");
      setEvaluation(null);
      return;
    }
    setPhase("finishing");
    try {
      setResult(await api.getQuizResult(quiz.session_id));
      setPhase("result");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("answering");
    }
  }

  if (!topics) {
    return <div className="p-6">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {error && <Alert>{error}</Alert>}

      {phase === "intro" && !topic && (
        <>
          <h1 className="text-3xl font-bold">Take a quiz</h1>
          <p className="text-ink-soft">Five questions on one topic. Choose a topic to begin.</p>
          <ul className="panel divide-y divide-line">
            {topics.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => router.replace(studyLink(item.slug, "quiz"))}
                  className="w-full px-4 py-3 text-left hover:bg-paper"
                >
                  <span className="block font-bold">{item.name}</span>
                  <span className="text-sm text-ink-soft">{item.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === "intro" && topic && (
        <div className="panel space-y-4 p-6">
          <h1 className="text-3xl font-bold">{topic.name} quiz</h1>
          <p className="text-ink-soft">
            Five questions at your current level. Each question has one attempt, and you&apos;ll see the answer after
            you submit.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={startQuiz}>
              Start quiz
            </button>
            <Link href="/quiz" className="btn btn-secondary">
              Choose another topic
            </Link>
          </div>
        </div>
      )}

      {phase === "generating" && <WaitingMessage label="Writing your quiz. This can take a few seconds…" />}

      {(phase === "answering" || phase === "finishing") && quiz && question && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{topic?.name} quiz</h1>
            <p className="text-sm text-ink-soft" aria-live="polite">
              Question {index + 1} of {quiz.questions.length}
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-blue"
              style={{ width: `${((index + (evaluation ? 1 : 0)) / quiz.questions.length) * 100}%` }}
            />
          </div>
          <div className="panel p-5 sm:p-6">
            <QuizQuestion
              key={question.id}
              question={question}
              answer={answer}
              onAnswerChange={setAnswer}
              onSubmit={submitAnswer}
              submitting={submitting}
              locked={evaluation !== null}
              result={evaluation}
            />
            {submitting && (
              <div className="mt-4">
                <WaitingMessage label="Checking your answer…" />
              </div>
            )}
          </div>
          {evaluation && (
            <button type="button" className="btn btn-primary" onClick={goToNext} disabled={phase === "finishing"}>
              {isLastQuestion ? (phase === "finishing" ? "Scoring…" : "See results") : "Next question"}
            </button>
          )}
        </>
      )}

      {phase === "result" && result && (
        <>
          <section className="panel space-y-5 p-6">
            <h1 className="text-3xl font-bold">Quiz complete</h1>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-ink-soft">Score</dt>
                <dd className="text-3xl font-bold">
                  {result.correct}/{result.total_questions}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">Accuracy</dt>
                <dd className="text-3xl font-bold">{result.accuracy}%</dd>
              </div>
            </dl>
            <ResultList title="Strong areas" items={result.strong_areas} empty="Keep going to build strengths here." />
            <ResultList title="Needs practice" items={result.needs_practice} empty="Nothing. Every answer was right!" />
          </section>

          <RecommendationCard recommendation={result.recommendation} />

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-secondary" onClick={startQuiz}>
              Take another quiz
            </button>
            <Link href={studyLink(result.topic_slug, "practice")} className="btn btn-secondary">
              Practice this topic
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function ResultList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h2 className="font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense>
      <QuizRunner />
    </Suspense>
  );
}
