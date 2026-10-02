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

interface FinalTestRunnerProps {
  test: FinalTest;
  onFinished: (finished: FinalTest) => void;
}

export default function FinalTestRunner({ test, onFinished }: FinalTestRunnerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(test.answers);
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
  const answeredCount = test.questions.filter((item) => (answers[item.id] ?? "").trim()).length;
  const unanswered = test.questions.length - answeredCount;

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

  function requestSubmit() {
    if (unanswered > 0) setConfirming(true);
    else void submit();
  }

  const lowTime = secondsLeft <= LOW_TIME_SECONDS;

  return (
    <div className="space-y-5">
      <div className="panel sticky top-2 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">{test.topic_name} final test</h1>
          <p className="text-sm text-ink-soft">
            {answeredCount} of {test.questions.length} answered ·{" "}
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
          <p className="font-bold">
            {unanswered} question{unanswered === 1 ? " is" : "s are"} unanswered.
          </p>
          <p className="text-sm">Unanswered questions count as incorrect. Submit anyway?</p>
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

      <nav aria-label="Questions" className="flex flex-wrap gap-2">
        {test.questions.map((item, itemIndex) => {
          const answered = Boolean((answers[item.id] ?? "").trim());
          const current = itemIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-current={current ? "step" : undefined}
              aria-label={`Question ${itemIndex + 1}${answered ? ", answered" : ""}`}
              className={`h-9 w-9 rounded-lg border text-sm font-bold ${
                current ? "border-blue ring-2 ring-blue/40" : "border-line"
              } ${answered ? "bg-blue-tint text-blue-deep" : "bg-surface text-ink-soft"}`}
            >
              {itemIndex + 1}
            </button>
          );
        })}
      </nav>

      {question && (
        <div className="panel p-5 sm:p-6">
          <p className="mb-3 text-sm font-bold text-ink-soft">
            Question {index + 1} of {test.questions.length}
          </p>
          <QuizQuestion
            key={question.id}
            question={question}
            answer={answers[question.id] ?? ""}
            onAnswerChange={(value) => changeAnswer(question.id, value)}
            onSubmit={() => setIndex((current) => Math.min(current + 1, test.questions.length - 1))}
            submitting={submitting}
            locked={submitting}
            result={null}
            showSubmit={false}
          />
        </div>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setIndex((current) => current - 1)}
          disabled={index === 0}
        >
          Previous
        </button>
        {index < test.questions.length - 1 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setIndex((current) => current + 1)}>
            Next
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