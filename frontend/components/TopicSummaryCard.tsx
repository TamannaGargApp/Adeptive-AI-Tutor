import type { TopicProgress } from "@/lib/types";

import { CompletionBadge, CompletionBar } from "./ui";

/** A compact, clickable topic summary. The full breakdown opens in a dialog. */
export default function TopicSummaryCard({ progress, onOpen }: { progress: TopicProgress; onOpen: () => void }) {
  const met = progress.requirements.filter((requirement) => requirement.met).length;
  const nextStep = progress.final_test_locked_until
    ? "Final test locked for now. Keep practicing while you wait."
    : progress.remarks[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="panel flex w-full flex-col gap-3 p-5 text-left transition-colors hover:border-blue/60"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="text-lg font-bold">{progress.topic_name}</span>
        <CompletionBadge status={progress.completion_status} />
      </span>

      <span className="block w-full space-y-1.5">
        <span className="flex items-baseline justify-between text-sm">
          <span>
            <span className="text-xl font-bold">{progress.completion_percent}%</span>{" "}
            <span className="text-ink-soft">complete</span>
          </span>
          <span className="text-ink-soft">
            {met} of {progress.requirements.length} requirements
          </span>
        </span>
        <CompletionBar percent={progress.completion_percent} label={`${progress.topic_name} completion`} />
      </span>

      {nextStep && <span className="line-clamp-2 text-sm text-ink-soft">{nextStep}</span>}

      <span className="mt-auto text-sm font-bold text-blue">View details →</span>
    </button>
  );
}