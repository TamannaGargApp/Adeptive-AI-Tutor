import type { CompletionRequirement } from "@/lib/types";

/** The topic completion rules, each ticked when met, with progress like "4/10" or "Best 80%". */
export default function CompletionChecklist({
  requirements,
  compact = false,
}: {
  requirements: CompletionRequirement[];
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-1 text-xs" : "space-y-1.5 text-sm"} aria-label="Completion requirements">
      {requirements.map((requirement) => (
        <li key={requirement.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`grid shrink-0 place-items-center rounded-full font-bold ${compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"} ${
              requirement.met ? "bg-good text-on-accent" : "border border-line text-transparent"
            }`}
          >
            ✓
          </span>
          <span className={`flex-1 ${requirement.met ? "" : "text-ink-soft"}`}>
            {requirement.label}
            <span className="sr-only">{requirement.met ? " (done)" : " (not yet)"}</span>
          </span>
          <span className="font-mono text-ink-soft">{requirement.progress}</span>
        </li>
      ))}
    </ul>
  );
}