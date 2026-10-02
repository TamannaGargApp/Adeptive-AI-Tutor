import { COMPLETION_LABELS } from "@/lib/labels";
import type { CompletionStatus } from "@/lib/types";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-ink-soft">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-blue" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info"; children: React.ReactNode }) {
  const styles = kind === "error" ? "border-bad/30 bg-bad-tint text-bad" : "border-blue/20 bg-blue-tint text-blue-deep";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

const COMPLETION_STYLES: Record<CompletionStatus, string> = {
  not_started: "bg-paper text-ink-soft border-line",
  needs_practice: "bg-bad-tint text-bad border-bad/25",
  in_progress: "bg-blue-tint text-blue-deep border-blue/25",
  almost_complete: "bg-sun-tint text-ink border-sun",
  complete: "bg-good-tint text-good border-good/25",
};

export function CompletionBadge({ status }: { status: CompletionStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${COMPLETION_STYLES[status]}`}
    >
      {COMPLETION_LABELS[status]}
    </span>
  );
}

export function CompletionBar({ percent, label = "Completion" }: { percent: number; label?: string }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-paper"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      {percent > 0 && (
        <div
          className={`h-full rounded-full ${percent === 100 ? "bg-good" : "bg-blue"}`}
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      )}
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-code px-4 py-3 font-mono text-sm leading-relaxed text-code-fg">
      <code>{code}</code>
    </pre>
  );
}