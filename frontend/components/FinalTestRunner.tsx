"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { formatDuration } from "@/lib/labels";
import type { FinalTest } from "@/lib/types";

import QuizQuestion from "./QuizQuestion";
import { Alert } from "./ui";

const AUTOSAVE_DELAY_MS = 700;
const LOW_TIME_SECONDS = 60;

type SaveStatus = "saved" | "saving" | "error";

/**
 * Navigator status for each question:
 * - answered:    has an answer (green)
 * - review:      marked for review, answered or not (yellow)
 * - skipped:     opened and left without an answer (red)
 * - not_visited: not opened yet (neutral)
 */
type QuestionStatus = "answered" | "review" | "skipped" | "not_visited";

const STATUS_STYLES: Record<QuestionStatus, string> = {
  answered: "border-good/50 bg-good-tint text-good",
  review: "border-sun bg-sun-tint text-ink",
  skipped: "border-bad/50 bg-bad-tint text-bad",
  not_visited: "border-line bg-surface text-ink-soft",
};

const STATUS_LABELS: Record<QuestionStatus, string> = {
  answered: "Answered",
  review: "Marked for review",
  skipped: "Skipped",
  not_visited: "Not visited",
};

const STATUS_ORDER: QuestionStatus[] = ["answered", "review", "skipped", "not_visited"];

interface FinalTestRunnerProps {
  test: FinalTest;
  onFinished: (finished: FinalTest) => void;
}

export default function FinalTestRunner({ test, onFinished }: FinalTestRunnerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(test.answers);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set(test.flagged));
  const [visited, setVisited] = useState<Set<string>>(() => new Set(test.visited));
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(test.seconds_remaining);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The server says how many seconds are left; counting down from that avoids clock differences.
  const deadlineRef = useRef(Date.now() + test.seconds_remaining * 1000);
  const answersRef = useRef(answers);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const submittedRef = useRef(false);

  answersRef.current = answers;
  const question = test.questions[index];
  const isAnswered = (questionId: string) => Boolean((answers[questionId] ?? "").trim());

  function statusOf(questionId: string): QuestionStatus {
    if (flagged.has(questionId)) return "review";
    if (isAnswered(questionId)) return "answered";
    if (visited.has(questionId)) return "skipped";
    return "not_visited";
  }

  const counts = STATUS_ORDER.reduce(
    (totals, status) => ({ ...totals, [status]: test.questions.filter((item) => statusOf(item.id) === status).length }),
    {} as Record<QuestionStatus, number>,
  );
  const unanswered = test.questions.filter((item) => !isAnswered(item.id)).length;

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    Object.values(saveTimersRef.current).forEach(clearTimeout);
    try {
      // Send every answer with the submission, so nothing waiting to autosave is lost.
      onFinished(await api.submitFinalTest(test.id, answersRef.current));
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(`${errorMessage(err)} Your answers are saved, so you can try submitting again.`);
    }
  }, [test.id, onFinished]);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        void submit();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [submit]);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  function changeAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setSaveStatus("saving");
    clearTimeout(saveTimersRef.current[questionId]);
    saveTimersRef.current[questionId] = setTimeout(async () => {
      try {
        await api.saveFinalTestAnswer(test.id, questionId, value);
        setSaveStatus("saved");
      } catch {
        // The answer is still sent with the final submission, so this is only a warning.
        setSaveStatus("error");
      }
    }, AUTOSAVE_DELAY_MS);
  }

  /** Leaving a question marks it as visited, so an unanswered one shows as skipped. */
  function goTo(nextIndex: number) {
    if (nextIndex === index || nextIndex < 0 || nextIndex >= test.questions.length) return;
    const leaving = test.questions[index];
    if (leaving && !visited.has(leaving.id)) {
      setVisited((current) => new Set(current).add(leaving.id));
      // The status is only for the navigator, so a failed save isn't worth interrupting the test for.
      api.updateFinalTestStatus(test.id, leaving.id, { visited: true }).catch(() => undefined);
    }
    setIndex(nextIndex);
  }

  function toggleReview(questionId: string) {
    const nextFlagged = !flagged.has(questionId);
    setFlagged((current) => {
      const next = new Set(current);
      if (nextFlagged) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
    api.updateFinalTestStatus(test.id, questionId, { flagged: nextFlagged }).catch(() => undefined);
  }

  function requestSubmit() {
    if (unanswered > 0 || flagged.size > 0) setConfirming(true);
    else void submit();
  }

  const lowTime = secondsLeft <= LOW_TIME_SECONDS;
  const markedForReview = question ? flagged.has(question.id) : false;

  return (
    <div className="space-y-5">
      <div className="panel sticky top-2 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">{test.title}</h1>
          <p className="text-sm text-ink-soft">
            {test.questions.length - unanswered} of {test.questions.length} answered ·{" "}
            {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Autosave failed, will retry on submit" : "All answers saved"}
          </p>
        </div>
        <p
          className={`rounded-lg px-3 py-1.5 font-mono text-xl font-bold ${lowTime ? "bg-bad-tint text-bad" : "bg-blue-tint text-blue-deep"}`}
          role="timer"
          aria-label={`Time left: ${formatDuration(secondsLeft)}`}
        >
          {formatDuration(secondsLeft)}
        </p>
        <button type="button" className="btn btn-primary" onClick={requestSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit test"}
        </button>
      </div>

      {lowTime && secondsLeft > 0 && (
        <Alert>Less than a minute left. The test submits automatically when time runs out.</Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {confirming && (
        <div className="rounded-lg border-l-4 border-sun bg-sun-tint px-4 py-3" role="alertdialog" aria-label="Confirm submission">
          <p className="font-bold">Submit the test now?</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {unanswered > 0 && (
              <li>
                {unanswered} question{unanswered === 1 ? " is" : "s are"} unanswered and will count as incorrect.
              </li>
            )}
            {flagged.size > 0 && (
              <li>
                {flagged.size} question{flagged.size === 1 ? " is" : "s are"} still marked for review.
              </li>
            )}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirming(false);
                void submit();
              }}
            >
              Submit now
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Keep working
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Question status legend">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded border ${STATUS_STYLES[status]}`} aria-hidden />
              {STATUS_LABELS[status]} ({counts[status]})
            </li>
          ))}
        </ul>
        <nav aria-label="Questions" className="flex flex-wrap gap-2">
          {test.questions.map((item, itemIndex) => {
            const status = statusOf(item.id);
            const current = itemIndex === index;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(itemIndex)}
                aria-current={current ? "step" : undefined}
                aria-label={`Question ${itemIndex + 1}: ${STATUS_LABELS[status]}`}
                title={STATUS_LABELS[status]}
                className={`h-9 w-9 rounded-lg border text-sm font-bold ${STATUS_STYLES[status]} ${
                  current ? "ring-2 ring-blue ring-offset-2 ring-offset-paper" : ""
                }`}
              >
                {itemIndex + 1}
              </button>
            );
          })}
        </nav>
      </div>

      {question && (
        <div className="panel p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink-soft">
              Question {index + 1} of {test.questions.length}
            </p>
            <button
              type="button"
              onClick={() => toggleReview(question.id)}
              aria-pressed={markedForReview}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
                markedForReview ? "border-sun bg-sun-tint text-ink" : "border-line text-ink-soft hover:border-sun"
              }`}
            >
              {markedForReview ? "Marked for review ✓" : "Mark for review"}
            </button>
          </div>
          <QuizQuestion
            key={question.id}
            question={question}
            answer={answers[question.id] ?? ""}
            onAnswerChange={(value) => changeAnswer(question.id, value)}
            onSubmit={() => goTo(index + 1)}
            submitting={submitting}
            locked={submitting}
            result={null}
            showSubmit={false}
          />
        </div>
      )}

      <div className="flex justify-between gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
          Previous
        </button>
        {index < test.questions.length - 1 ? (
          <button type="button" className="btn btn-secondary" onClick={() => goTo(index + 1)}>
            {isAnswered(question?.id ?? "") ? "Next" : "Skip"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={requestSubmit} disabled={submitting}>
            Submit test
          </button>
        )}
      </div>
    </div>
  );
}