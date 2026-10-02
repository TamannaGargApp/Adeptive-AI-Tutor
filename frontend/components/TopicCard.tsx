import Link from "next/link";

import { MODE_LABELS, MODES, studyLink } from "@/lib/labels";
import type { Topic, TopicProgress } from "@/lib/types";

import { CompletionBadge, CompletionBar } from "./ui";

export default function TopicCard({ topic, progress }: { topic: Topic; progress?: TopicProgress }) {
  const attempted = progress?.questions_attempted ?? 0;
  return (
    <article className="panel flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold leading-snug">{topic.name}</h2>
        <CompletionBadge status={progress?.completion_status ?? "not_started"} />
      </div>
      <p className="text-sm text-ink-soft">{topic.description}</p>

      {attempted > 0 && progress && (
        <div className="space-y-1.5">
          <CompletionBar percent={progress.completion_percent} label={`${topic.name} completion`} />
          <p className="text-xs text-ink-soft">
            {progress.completion_percent}% complete
            {progress.remarks[0] && !progress.completed ? ` · ${progress.remarks[0]}` : ""}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <Link
            key={mode}
            href={studyLink(topic.slug, mode)}
            className={`btn px-3 py-1.5 text-sm ${mode === "learn" ? "btn-primary" : "btn-secondary"}`}
          >
            {MODE_LABELS[mode]}
          </Link>
        ))}
      </div>
    </article>
  );
}