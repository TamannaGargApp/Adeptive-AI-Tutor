import { LEVEL_LABELS, MASTERY_LABELS } from "@/lib/labels";
import type { TopicProgress } from "@/lib/types";

import { CompletionBadge, CompletionBar } from "./ui";

function ConceptChips({ covered, remaining }: { covered: string[]; remaining: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Key concepts">
      {covered.map((concept) => (
        <li key={concept} className="rounded-md bg-good-tint px-2 py-0.5 font-mono text-xs text-good">
          <span aria-hidden>✓ </span>
          {concept}
          <span className="sr-only"> (covered)</span>
        </li>
      ))}
      {remaining.map((concept) => (
        <li key={concept} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-ink-soft">
          {concept}
          <span className="sr-only"> (not covered yet)</span>
        </li>
      ))}
    </ul>
  );
}

export default function ProgressCard({ progress }: { progress: TopicProgress }) {
  const started = progress.questions_attempted > 0;
  const remarksTone = progress.completed
    ? "border-good bg-good-tint"
    : progress.completion_status === "needs_practice"
      ? "border-bad bg-bad-tint"
      : "border-sun bg-sun-tint";

  return (
    <article className="panel space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">{progress.topic_name}</h2>
        <CompletionBadge status={progress.completion_status} />
      </div>

      <div className="space-y-1.5">
        <p>
          <span className="text-2xl font-bold">{progress.completion_percent}%</span>{" "}
          <span className="text-sm text-ink-soft">complete</span>
        </p>
        <CompletionBar percent={progress.completion_percent} label={`${progress.topic_name} completion`} />
      </div>

      <ul className="space-y-1.5 text-sm" aria-label="Completion requirements">
        {progress.requirements.map((requirement) => (
          <li key={requirement.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${
                requirement.met ? "bg-good text-white" : "border border-line text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="flex-1">
              {requirement.label}
              <span className="sr-only">{requirement.met ? " (done)" : " (not yet)"}</span>
            </span>
            <span className="font-mono text-xs text-ink-soft">{requirement.progress}</span>
          </li>
        ))}
      </ul>

      <ConceptChips covered={progress.concepts_covered} remaining={progress.concepts_remaining} />

      <div className={`rounded-lg border-l-4 px-4 py-3 ${remarksTone}`}>
        <h3 className="text-sm font-bold">Remarks</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {progress.remarks.map((remark) => (
            <li key={remark}>{remark}</li>
          ))}
        </ul>
      </div>

      {started && (
        <p className="text-xs text-ink-soft">
          All-time accuracy {progress.accuracy}% ({MASTERY_LABELS[progress.mastery]}) ·{" "}
          {progress.correct_answers}/{progress.questions_attempted} first attempts correct · Difficulty:{" "}
          {LEVEL_LABELS[progress.current_difficulty]}
        </p>
      )}
    </article>
  );
}