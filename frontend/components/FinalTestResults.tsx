import Link from "next/link";

import { formatDuration, studyLink } from "@/lib/labels";
import type { FinalTest, FinalTestResult, QuestionReview } from "@/lib/types";

import Markdown from "./Markdown";
import RecommendationCard from "./RecommendationCard";
import { CodeBlock } from "./ui";

interface FinalTestResultsProps {
  test: FinalTest;
  result: FinalTestResult;
  onRetake: () => void;
}

export default function FinalTestResults({ test, result, onRetake }: FinalTestResultsProps) {
  const passed = result.accuracy >= 70;
  return (
    <div className="space-y-6">
      <section className="panel space-y-5 p-6" aria-labelledby="result-heading">
        <div>
          <p className="text-sm font-bold text-ink-soft">{test.topic_name} final test</p>
          <h1 id="result-heading" className="text-3xl font-bold">
            Test analysis
          </h1>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-ink-soft">Score</dt>
            <dd className={`text-3xl font-bold ${passed ? "text-good" : "text-bad"}`}>
              {result.correct}/{result.total}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Accuracy</dt>
            <dd className="text-3xl font-bold">{result.accuracy}%</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Time taken</dt>
            <dd className="text-3xl font-bold">{formatDuration(result.time_taken_seconds)}</dd>
            <dd className="text-xs text-ink-soft">of {formatDuration(test.time_limit_seconds)}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Finished</dt>
            <dd className="text-lg font-bold">{result.finished_by === "time_up" ? "Time ran out" : "Submitted"}</dd>
          </div>
        </dl>

        <div className={`rounded-lg border-l-4 px-4 py-3 ${passed ? "border-good bg-good-tint" : "border-sun bg-sun-tint"}`}>
          <h2 className="text-sm font-bold">Remarks</h2>
          <ul className="mt-1 space-y-1 text-sm">
            {result.remarks.map((remark) => (
              <li key={remark}>{remark}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel space-y-4 p-6" aria-labelledby="concepts-heading">
        <h2 id="concepts-heading" className="text-xl font-bold">
          By concept
        </h2>
        <ul className="space-y-3">
          {result.concept_scores.map((score) => {
            const percent = Math.round((score.correct / score.total) * 100);
            return (
              <li key={score.concept} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3">
                <span className="truncate font-mono text-sm">{score.concept}</span>
                <span className="h-2 overflow-hidden rounded-full bg-paper" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${percent >= 75 ? "bg-good" : "bg-bad"}`}
                    style={{ width: `${Math.max(percent, 3)}%` }}
                  />
                </span>
                <span className="text-sm font-bold">
                  {score.correct}/{score.total}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <ConceptGroup title="Strong areas" items={result.strong_areas} empty="Keep practicing to build strengths." />
          <ConceptGroup title="Needs practice" items={result.needs_practice} empty="Nothing. Every concept was answered well!" />
        </div>
      </section>

      {test.recommendation && <RecommendationCard recommendation={test.recommendation} />}

      <section className="space-y-4" aria-labelledby="review-heading">
        <h2 id="review-heading" className="text-xl font-bold">
          Question review
        </h2>
        {result.review.map((review, index) => (
          <ReviewItem key={review.question_id} review={review} number={index + 1} />
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={onRetake}>
          Take a new final test
        </button>
        <Link href={studyLink(test.topic_slug, "practice")} className="btn btn-secondary">
          Practice this topic
        </Link>
        <Link href="/progress" className="btn btn-secondary">
          View progress
        </Link>
      </div>
    </div>
  );
}

function ConceptGroup({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewItem({ review, number }: { review: QuestionReview; number: number }) {
  const answered = review.your_answer.length > 0;
  return (
    <article className={`panel space-y-3 border-l-4 p-5 ${review.correct ? "border-l-good" : "border-l-bad"}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold">Question {number}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${review.correct ? "bg-good-tint text-good" : "bg-bad-tint text-bad"}`}>
          {review.correct ? "Correct" : answered ? "Incorrect" : "Not answered"}
        </span>
        <span className="font-mono text-xs text-ink-soft">{review.concept}</span>
      </div>

      <div className="font-bold">
        <Markdown content={review.prompt} />
      </div>
      {review.code && <CodeBlock code={review.code} />}

      {review.question_type === "multiple_choice" ? (
        <ul className="space-y-1.5">
          {review.options.map((option) => {
            const isCorrect = option === review.correct_answer;
            const isChosen = option.toLowerCase() === review.your_answer.toLowerCase();
            const style = isCorrect
              ? "border-good bg-good-tint"
              : isChosen
                ? "border-bad bg-bad-tint"
                : "border-line";
            return (
              <li key={option} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${style}`}>
                <span className="font-mono text-sm">{option}</span>
                <span className="text-xs font-bold">
                  {isCorrect ? "Correct answer" : isChosen ? "Your answer" : ""}
                  {isCorrect && isChosen ? " · Your answer" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-bold">Your answer</p>
            {answered ? <CodeBlock code={review.your_answer} /> : <p className="text-sm text-ink-soft">No answer given.</p>}
          </div>
          <div>
            <p className="mb-1 text-sm font-bold">Correct answer</p>
            <CodeBlock code={review.correct_answer} />
          </div>
        </div>
      )}

      <p className="text-sm text-ink-soft">{review.explanation}</p>
    </article>
  );
}