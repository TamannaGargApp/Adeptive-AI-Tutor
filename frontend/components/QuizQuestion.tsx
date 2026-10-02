"use client";

import type { EvaluationResult, Question } from "@/lib/types";

import Markdown from "./Markdown";
import { CodeBlock } from "./ui";

interface QuizQuestionProps {
  question: Question;
  answer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  /** True once the question can no longer be answered (solved, or out of attempts). */
  locked: boolean;
  result: EvaluationResult | null;
  /** False in the final test, where answers are only checked when the whole test is submitted. */
  showSubmit?: boolean;
}

const INPUT_LABELS = {
  predict_output: "What does it print? Type the exact output.",
  short_answer: "Your answer",
  multiple_choice: "Choose one answer",
} as const;

export default function QuizQuestion({
  question,
  answer,
  onAnswerChange,
  onSubmit,
  submitting,
  locked,
  result,
  showSubmit = true,
}: QuizQuestionProps) {
  const canSubmit = answer.trim().length > 0 && !submitting && !locked;
  const inputId = `answer-${question.id}`;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          Concept: <span className="font-mono text-blue-deep">{question.concept}</span>
        </p>
        <div className="text-lg font-bold">
          <Markdown content={question.prompt} />
        </div>
        {question.code && <CodeBlock code={question.code} />}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
        className="space-y-3"
      >
        {question.question_type === "multiple_choice" ? (
          <fieldset className="space-y-2" disabled={locked || submitting}>
            <legend className="mb-2 text-sm font-bold">{INPUT_LABELS.multiple_choice}</legend>
            {question.options.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                  answer === option ? "border-blue bg-blue-tint" : "border-line bg-surface hover:border-blue/50"
                }`}
              >
                <input
                  type="radio"
                  name={inputId}
                  value={option}
                  checked={answer === option}
                  onChange={() => onAnswerChange(option)}
                  className="accent-blue"
                />
                <span className="font-mono text-sm">{option}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="space-y-2">
            <label htmlFor={inputId} className="block text-sm font-bold">
              {INPUT_LABELS[question.question_type]}
            </label>
            <textarea
              id={inputId}
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={locked || submitting}
              rows={question.question_type === "predict_output" ? 3 : 4}
              maxLength={2000}
              className={`input resize-y ${question.question_type === "predict_output" ? "font-mono" : ""}`}
              placeholder={question.question_type === "predict_output" ? "0\n1\n2" : "Explain in your own words"}
            />
          </div>
        )}

        {showSubmit && !locked && (
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? "Checking…" : result && !result.correct ? "Check again" : "Check answer"}
          </button>
        )}
      </form>

      {result && <Feedback result={result} />}
    </div>
  );
}

function Feedback({ result }: { result: EvaluationResult }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <div
        className={`rounded-lg border px-4 py-3 ${
          result.correct ? "border-good/30 bg-good-tint" : "border-bad/30 bg-bad-tint"
        }`}
      >
        <p className={`font-bold ${result.correct ? "text-good" : "text-bad"}`}>
          {result.correct ? "Correct" : "Not quite"}
        </p>
        <div className="mt-1 text-ink">
          <Markdown content={result.feedback} />
        </div>
      </div>

      {result.hint && (
        <div className="rounded-lg border-l-4 border-sun bg-sun-tint px-4 py-3">
          <p className="text-sm font-bold">Hint</p>
          <div className="text-ink">
            <Markdown content={result.hint} />
          </div>
        </div>
      )}

      {result.correct_answer && !result.correct && (
        <div className="space-y-2">
          <p className="text-sm font-bold">Correct answer</p>
          <CodeBlock code={result.correct_answer} />
          {result.explanation && <p className="text-ink-soft">{result.explanation}</p>}
        </div>
      )}
    </div>
  );
}