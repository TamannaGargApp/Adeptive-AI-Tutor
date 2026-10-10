import Link from "next/link";
import { useId } from "react";

import { COMPLETION_LABELS } from "@/lib/labels";
import type { CompletionStatus } from "@/lib/types";

import { Icon, type IconName } from "./Icon";

/** Vivid gradient icon tiles, cycling through the logo's colours (see .tile-* in globals.css). */
export const TONES = ["tile-blue", "tile-violet", "tile-cyan", "tile-magenta", "tile-amber", "tile-green"];

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-ink-soft">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-violet border-r-blue" aria-hidden />
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
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <span aria-hidden className="mt-0.5 shrink-0 font-bold">
        {kind === "error" ? "!" : "i"}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * The header at the top of each app page: a gradient icon tile, title and description, with
 * optional actions on the right and optional content (stats, tabs) underneath.
 */
export function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  actions,
  children,
  back,
}: {
  icon?: IconName;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** A link back to the parent page, shown above the title. */
  back?: { href: string; label: string };
}) {
  return (
    // An open header, like the landing page: no box, just the title on the page with soft
    // coloured light behind it, twinkling stars, and a fading divider underneath.
    <header className="relative pt-2 pb-1 sm:pt-4">
      {back && (
        <Link
          href={back.href}
          className="relative mb-3 inline-flex items-center gap-1 text-sm font-bold text-violet hover:text-blue"
        >
          <span aria-hidden className="inline-block rotate-180">
            <Icon name="arrow" size={15} />
          </span>
          {back.label}
        </Link>
      )}
      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4">
        {icon && (
          <span className="bg-brand grid h-12 w-12 shrink-0 place-items-center rounded-2xl brand-shadow sm:h-16 sm:w-16">
            <Icon name={icon} size={28} />
          </span>
        )}
        {/* basis-56: on narrow screens the actions wrap below instead of squeezing the title. */}
        <div className="min-w-0 flex-1 basis-56">
          {eyebrow && <p className="text-xs font-bold tracking-wider text-violet uppercase">{eyebrow}</p>}
          <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-ink-soft sm:text-lg">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="relative mt-6">{children}</div>}
      <div aria-hidden className="hero-divider mt-6" />
    </header>
  );
}

/** A four-point star like the one in the logo; twinkles when given the "twinkle" class. */
export function Sparkle({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path
        fill="currentColor"
        d="M12 0c.6 5.6 2.4 9.4 12 12-9.6 2.6-11.4 6.4-12 12-.6-5.6-2.4-9.4-12-12 9.6-2.6 11.4-6.4 12-12z"
      />
    </svg>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="flex items-center gap-2.5 text-xl font-bold">
          <span aria-hidden className="heading-accent" />
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** A small statistic: icon tile, label, big value, and an optional hint or bar underneath. */
export function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 0,
  children,
}: {
  icon: IconName;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: number;
  children?: React.ReactNode;
}) {
  return (
    // Open (no box): an icon tile and a big number, set in a strip by the page (see the dashboard).
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4" data-reveal>
      <span className={`icon-tile h-11 w-11 shrink-0 ${TONES[tone % TONES.length]}`}>
        <Icon name={icon} size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-soft">{label}</p>
        <p className="text-xl leading-tight font-bold sm:text-2xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

/** A circular progress indicator with the logo gradient, and the percentage (or children) inside. */
export function ProgressRing({
  percent,
  size = 96,
  stroke = 9,
  label = "Progress",
  children,
  colors,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  children?: React.ReactNode;
  /** Gradient start and end colours (indigo → violet by default). */
  colors?: [string, string];
}) {
  // useId returns ids like ":r1:", which aren't valid inside url(#...).
  const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={clamped >= 100 ? "var(--color-good)" : (colors?.[0] ?? "var(--color-blue)")} />
            <stop offset="100%" stopColor={clamped >= 100 ? "var(--color-good)" : (colors?.[1] ?? "var(--color-violet)")} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped / 100)}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        {children ?? <span className="text-xl font-bold">{Math.round(clamped)}%</span>}
      </span>
    </div>
  );
}

/** A friendly placeholder for empty lists. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel bg-dots flex flex-col items-center px-6 py-12 text-center">
      <span className="icon-tile h-14 w-14 bg-violet-tint text-violet">
        <Icon name={icon} size={26} />
      </span>
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      {text && <p className="mt-1 max-w-md text-ink-soft">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A row of mutually exclusive options in one pill, e.g. Beginner / Intermediate / Advanced. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    // A container query stacks the options when there isn't room for one row (a narrow sidebar,
    // or larger browser text), so a long label like "Intermediate" never spills out of the box.
    <div className="@container">
      <div
        role="group"
        aria-label={label}
        className="flex flex-col gap-1 rounded-xl border border-line bg-paper p-1 @[16rem]:flex-row @[16rem]:gap-0"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`flex-auto rounded-lg font-bold whitespace-nowrap transition-colors ${
                size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
              } ${selected ? "bg-brand shadow-[var(--shadow-soft)]" : "text-ink-soft hover:text-ink"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const COMPLETION_STYLES: Record<CompletionStatus, { badge: string; dot: string }> = {
  not_started: { badge: "bg-paper text-ink-soft border-line", dot: "bg-ink-soft/50" },
  needs_practice: { badge: "bg-bad-tint text-bad border-bad/25", dot: "bg-bad" },
  in_progress: { badge: "bg-blue-tint text-blue-deep border-blue/25", dot: "bg-blue" },
  almost_complete: { badge: "bg-sun-tint text-ink border-sun/60", dot: "bg-sun" },
  complete: { badge: "bg-good-tint text-good border-good/25", dot: "bg-good" },
};

export function CompletionBadge({ status }: { status: CompletionStatus }) {
  const style = COMPLETION_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${style.badge}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {COMPLETION_LABELS[status]}
    </span>
  );
}

export function CompletionBar({ percent, label = "Completion" }: { percent: number; label?: string }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-line/70"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      {percent > 0 && (
        <div
          className={`h-full rounded-full ${percent === 100 ? "bg-good" : "bar-glow"}`}
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      )}
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-code px-4 py-3 font-mono text-sm leading-relaxed text-code-fg">
      <code>{code}</code>
    </pre>
  );
}
