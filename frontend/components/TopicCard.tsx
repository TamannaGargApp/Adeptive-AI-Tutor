import Link from "next/link";

import { FAILS_BEFORE_COOLDOWN, finalTestLink, MODE_LABELS, MODES, studyLink } from "@/lib/labels";
import type { Topic, TopicProgress } from "@/lib/types";

import CompletionChecklist from "./CompletionChecklist";
import Countdown from "./Countdown";
import { Icon } from "./Icon";
import { CompletionBadge, CompletionBar, ProgressRing } from "./ui";

/** A compact, clickable topic card. Study options and details open in a dialog (TopicDetail). */
export default function TopicCard({
  topic,
  progress,
  onOpen,
}: {
  topic: Topic;
  progress?: TopicProgress;
  onOpen: () => void;
}) {
  const percent = progress?.completion_percent ?? 0;
  const met = progress?.requirements.filter((requirement) => requirement.met).length ?? 0;
  const total = progress?.requirements.length ?? 0;

  const done = progress?.completed ?? false;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="group panel card-lift flex w-full flex-col gap-3 p-5 text-left"
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span
          aria-hidden
          className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${
            done ? "bg-good-tint text-good" : percent > 0 ? "bg-brand" : "bg-paper text-ink-soft"
          }`}
        >
          {done ? <Icon name="check" size={17} /> : topic.order + 1}
        </span>
        <CompletionBadge status={progress?.completion_status ?? "not_started"} />
      </span>
      <span className="text-lg leading-snug font-bold">{topic.name}</span>
      <span className="line-clamp-2 text-sm text-ink-soft">{topic.description}</span>

      <span className="mt-auto flex w-full items-center gap-3 border-t border-line pt-4">
        <ProgressRing percent={percent} size={46} stroke={5} label={`${topic.name} completion`}>
          <span className="text-[11px] font-bold">{percent}%</span>
        </ProgressRing>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-bold">{done ? "Complete" : percent > 0 ? "Keep going" : "Not started yet"}</span>
          {total > 0 && (
            <span className="text-ink-soft">
              {met} of {total} requirements met
            </span>
          )}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-paper text-violet transition-transform group-hover:translate-x-0.5">
          <Icon name="arrow" size={15} />
        </span>
      </span>
    </button>
  );
}

/** Everything about a topic plus the ways to study it, shown inside a dialog. */
export function TopicDetail({ topic, progress }: { topic: Topic; progress?: TopicProgress }) {
  const covered = new Set(progress?.concepts_covered ?? []);
  const lockedUntil = progress?.final_test_locked_until ?? null;

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-soft">{topic.description}</p>
        <CompletionBadge status={progress?.completion_status ?? "not_started"} />
      </div>

      <section aria-labelledby="study-heading">
        <h3 id="study-heading" className="mb-2 text-sm font-bold text-ink-soft">
          Study this topic
        </h3>
        <div className="flex flex-wrap gap-2">
          {MODES.map((mode) => (
            <Link
              key={mode}
              href={studyLink(topic.slug, mode)}
              className={`btn px-3 py-1.5 text-sm ${mode === "learn" ? "btn-primary" : "btn-secondary"}`}
            >
              {MODE_LABELS[mode]}
            </Link>
          ))}
          {!lockedUntil && (
            <Link href={finalTestLink(topic.slug)} className="btn btn-secondary px-3 py-1.5 text-sm">
              {progress?.final_test_passed ? "Final test ✓" : "Final test"}
            </Link>
          )}
        </div>
        {lockedUntil && (
          <p className="mt-2 text-sm text-ink-soft">
            Final test locked after {FAILS_BEFORE_COOLDOWN} failed attempts in a row. Opens in{" "}
            <Countdown until={lockedUntil} />
          </p>
        )}
      </section>

      {progress && (
        <section aria-labelledby="complete-heading" className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 id="complete-heading" className="text-sm font-bold text-ink-soft">
              To complete this topic
            </h3>
            <span className="text-sm font-bold">{progress.completion_percent}%</span>
          </div>
          <CompletionBar percent={progress.completion_percent} label={`${topic.name} completion`} />
          <CompletionChecklist requirements={progress.requirements} />
        </section>
      )}

      <section aria-labelledby="concepts-heading">
        <h3 id="concepts-heading" className="mb-2 text-sm font-bold text-ink-soft">
          Key concepts
        </h3>
        <ul className="flex flex-wrap gap-1.5">
          {topic.key_concepts.map((concept) => (
            <li
              key={concept}
              className={`rounded-md px-2 py-0.5 font-mono text-xs ${
                covered.has(concept) ? "bg-good-tint text-good" : "border border-line text-ink-soft"
              }`}
            >
              {covered.has(concept) && <span aria-hidden>✓ </span>}
              {concept}
              <span className="sr-only">{covered.has(concept) ? " (covered)" : " (not covered yet)"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}