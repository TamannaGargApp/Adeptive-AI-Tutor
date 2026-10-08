import type { TopicProgress } from "@/lib/types";

import { Icon } from "./Icon";
import { CompletionBadge, ProgressRing } from "./ui";

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
      className="group panel card-lift flex w-full flex-col gap-4 p-5 text-left"
    >
      <span className="flex w-full items-start gap-4">
        <ProgressRing percent={progress.completion_percent} size={58} stroke={6} label={`${progress.topic_name} completion`}>
          <span className="text-xs font-bold">{progress.completion_percent}%</span>
        </ProgressRing>
        <span className="min-w-0 flex-1">
          <span className="block text-lg leading-snug font-bold">{progress.topic_name}</span>
          <span className="mt-1 block text-sm text-ink-soft">
            {met} of {progress.requirements.length} requirements · {progress.accuracy}% accuracy
          </span>
        </span>
      </span>
      <span className="self-start">
        <CompletionBadge status={progress.completion_status} />
      </span>
      {nextStep && <span className="line-clamp-2 text-sm text-ink-soft">{nextStep}</span>}

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-violet">
        View details <Icon name="arrow" size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}