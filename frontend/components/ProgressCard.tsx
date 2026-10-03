import Link from "next/link";

import { FAILS_BEFORE_COOLDOWN, finalTestLink, LEVEL_LABELS, MASTERY_LABELS } from "@/lib/labels";
import type { TopicProgress } from "@/lib/types";

import CompletionChecklist from "./CompletionChecklist";
import Countdown from "./Countdown";
import { CompletionBadge, CompletionBar } from "./ui";

function FinalTestAction({ progress }: { progress: TopicProgress }) {
  if (progress.final_test_locked_until) {
    return (
      <p className="rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
        Final test locked after {FAILS_BEFORE_COOLDOWN} failed attempts in a row. Opens again in{" "}
        <Countdown until={progress.final_test_locked_until} />
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={finalTestLink(progress.topic_slug)}
        className={`btn px-3 py-1.5 text-sm ${progress.ready_for_final_test ? "btn-primary" : "btn-secondary"}`}
      >
        {progress.ready_for_final_test ? "You're ready: take the final test" : "Take the final test"}
      </Link>
      {progress.final_test_fails_in_row > 0 && (
        <span className="text-xs text-ink-soft">
          {progress.final_test_fails_in_row} of {FAILS_BEFORE_COOLDOWN} failed attempts in a row
        </span>
      )}
    </div>
  );
}

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

/** Full detail for one topic. `embedded` drops the card frame and title, for use inside a dialog. */
export default function ProgressCard({ progress, embedded = false }: { progress: TopicProgress; embedded?: boolean }) {
  const started = progress.questions_attempted > 0;
  const remarksTone = progress.completed
    ? "border-good bg-good-tint"
    : progress.completion_status === "needs_practice"
      ? "border-bad bg-bad-tint"
      : "border-sun bg-sun-tint";

  return (
    <article className={embedded ? "space-y-4 p-5" : "panel space-y-4 p-5"}>
      <div className="flex items-start justify-between gap-3">
        {embedded ? <span /> : <h2 className="text-lg font-bold">{progress.topic_name}</h2>}
        <CompletionBadge status={progress.completion_status} />
      </div>

      <div className="space-y-1.5">
        <p>
          <span className="text-2xl font-bold">{progress.completion_percent}%</span>{" "}
          <span className="text-sm text-ink-soft">complete</span>
        </p>
        <CompletionBar percent={progress.completion_percent} label={`${progress.topic_name} completion`} />
      </div>

      <CompletionChecklist requirements={progress.requirements} />

      <ConceptChips covered={progress.concepts_covered} remaining={progress.concepts_remaining} />

      <div className={`rounded-lg border-l-4 px-4 py-3 ${remarksTone}`}>
        <h3 className="text-sm font-bold">Remarks</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {progress.remarks.map((remark) => (
            <li key={remark}>{remark}</li>
          ))}
        </ul>
      </div>

      {!progress.completed && <FinalTestAction progress={progress} />}

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