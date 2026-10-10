"use client";

import { useEffect, useState } from "react";

import { Icon, type IconName } from "./Icon";

export { Icon, type IconName };

/**
 * Original illustrations for the landing page: a small line-icon set, the hero collage, and an
 * interactive preview of the study set tools. Everything is plain HTML/SVG in the theme colours, so
 * it works in light and dark mode and needs no image files. Mockups are decorative (aria-hidden);
 * the text beside them describes the feature.
 */

/** Tint classes for icon tiles, cycling through the logo's colours. */
/** Vivid icon tiles, the same as inside the app (see .tile-* in globals.css). */
export const TILE_TONES = ["tile-blue", "tile-amber", "tile-cyan", "tile-magenta", "tile-green", "tile-violet"];

/* ---------- Study set showcase: one interactive preview, switched by tabs ---------- */

const SAMPLE_FILE = "Biology – Photosynthesis.pdf";

function NotesPreview() {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-lg font-bold">Photosynthesis</p>
        <p className="mt-1 text-ink-soft">
          Plants turn <strong className="text-ink">light energy</strong> into chemical energy stored in{" "}
          <strong className="text-ink">glucose</strong>.
        </p>
      </div>
      <div>
        <p className="font-bold">Where it happens</p>
        <p className="mt-1 text-ink-soft">
          In the <span className="rounded bg-violet-tint px-1 font-bold text-violet">chloroplasts</span>, using the green
          pigment <span className="rounded bg-violet-tint px-1 font-bold text-violet">chlorophyll</span>.
        </p>
      </div>
      <p className="rounded-lg border border-line bg-paper px-3 py-2 text-center font-mono text-xs">
        6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Light reactions", "Capture light and split water, releasing oxygen."],
          ["Calvin cycle", "Uses that energy to build glucose from CO₂."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-lg border border-line p-3">
            <p className="font-bold">{title}</p>
            <p className="mt-1 text-xs text-ink-soft">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryPreview() {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold">Key points</p>
        <span className="rounded-full bg-cyan-tint px-2.5 py-0.5 text-xs font-bold text-cyan">2 min read</span>
      </div>
      <ul className="space-y-2">
        {[
          "Photosynthesis converts light energy into glucose.",
          "It takes place in chloroplasts, using chlorophyll.",
          "Carbon dioxide and water go in; oxygen comes out.",
          "Light reactions feed energy to the Calvin cycle.",
        ].map((point) => (
          <li key={point} className="flex gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-good-tint text-good">
              <Icon name="check" size={11} />
            </span>
            {point}
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Key terms</p>
        <div className="flex flex-wrap gap-1.5">
          {["Chlorophyll", "Stomata", "Glucose", "ATP", "Calvin cycle"].map((term, index) => (
            <span
              key={term}
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                index === 0 ? "bg-violet text-white" : "border border-line text-ink-soft"
              }`}
            >
              {term}
            </span>
          ))}
        </div>
        <p className="mt-2 rounded-lg bg-violet-tint px-3 py-2 text-xs">
          <strong>Chlorophyll:</strong> the green pigment that absorbs light for photosynthesis.
        </p>
      </div>
    </div>
  );
}

function QuizPreview() {
  const options = ["Mitochondria", "Chloroplasts", "Nucleus", "Ribosomes"];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
            <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? "bg-violet" : "bg-line"}`} />
          ))}
        </div>
        <span className="text-xs font-bold text-ink-soft">3 of 8</span>
      </div>
      <p className="text-base font-bold">Where in a plant cell does photosynthesis take place?</p>
      <ul className="grid grid-cols-2 gap-2">
        {options.map((option, index) => (
          <li
            key={option}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
              option === "Chloroplasts" ? "border-good bg-good-tint font-bold text-good" : "border-line"
            }`}
          >
            <span className="text-xs text-ink-soft">{String.fromCharCode(65 + index)}</span>
            {option}
          </li>
        ))}
      </ul>
      <p className="rounded-lg border-l-4 border-good bg-good-tint px-3 py-2">
        <strong className="text-good">Correct!</strong> Chloroplasts contain chlorophyll, which captures the light.
      </p>
    </div>
  );
}

function TutorPreview() {
  return (
    <div className="space-y-3 text-sm">
      <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-blue px-3.5 py-2 text-on-accent">
        Why do leaves look green?
      </p>
      <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5">
        Chlorophyll absorbs <strong>red</strong> and <strong>blue</strong> light but reflects{" "}
        <strong className="text-good">green</strong>, so that&apos;s the colour we see. Want me to quiz you on it?
      </div>
      <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-blue px-3.5 py-2 text-on-accent">Yes, quiz me!</p>
      <div className="flex w-fit gap-1 rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-3">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet" style={{ animationDelay: `${dot * 200}ms` }} />
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-ink-soft">
        <Icon name="clip" size={15} />
        <span className="flex-1 text-xs">Ask about your notes…</span>
        <Icon name="mic" size={15} />
        <span className="bg-brand rounded-md px-2 py-0.5 text-[11px] font-bold">Send</span>
      </div>
    </div>
  );
}

const SHOWCASE_TOOLS: {
  id: string;
  icon: IconName;
  title: string;
  tagline: string;
  points: string[];
  Preview: () => React.ReactElement;
}[] = [
  {
    id: "notes",
    icon: "notes",
    title: "AI Notes",
    tagline: "Notes that write themselves",
    points: ["Clear headings and short sections", "Key terms highlighted", "Examples where they help"],
    Preview: NotesPreview,
  },
  {
    id: "summary",
    icon: "summary",
    title: "AI Summary",
    tagline: "Review faster, anytime",
    points: ["The main points in minutes", "Key terms with definitions", "Perfect the night before a test"],
    Preview: SummaryPreview,
  },
  {
    id: "quiz",
    icon: "quiz",
    title: "AI Quizzes",
    tagline: "Test yourself before the exam does",
    points: ["Questions made from your material", "Every answer explained", "New questions each time"],
    Preview: QuizPreview,
  },
  {
    id: "tutor",
    icon: "chat",
    title: "AI Tutor",
    tagline: "Ask questions, get clarity",
    points: ["Answers based on your notes", "Hints before answers", "Quizzes you one question at a time"],
    Preview: TutorPreview,
  },
];

const ROTATE_MS = 6000;

/**
 * The study set tools in one interactive preview. It rotates through the tools on its own until the
 * visitor picks one (or prefers reduced motion), and pauses while hovered or focused.
 */
export function StudySetShowcase({ ctaHref }: { ctaHref: string }) {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAutoplay(false);
  }, []);

  useEffect(() => {
    if (!autoplay || paused) return;
    const timer = setTimeout(() => setActive((current) => (current + 1) % SHOWCASE_TOOLS.length), ROTATE_MS);
    return () => clearTimeout(timer);
  }, [active, autoplay, paused]);

  const tool = SHOWCASE_TOOLS[active];

  return (
    <div
      className="panel grid overflow-hidden lg:grid-cols-[300px_1fr]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        role="tablist"
        aria-label="Study set tools"
        aria-orientation="vertical"
        className="grid grid-cols-2 gap-2 border-b border-line p-3 lg:flex lg:flex-col lg:border-r lg:border-b-0"
      >
        {SHOWCASE_TOOLS.map((item, index) => {
          const selected = index === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`showcase-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="showcase-panel"
              onClick={() => {
                setActive(index);
                setAutoplay(false);
              }}
              className={`relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left transition-colors sm:px-4 sm:py-3.5 ${
                selected ? "border-violet/40 bg-violet-tint" : "border-transparent hover:bg-paper"
              }`}
            >
              <span className={`icon-tile h-9 w-9 shrink-0 sm:h-11 sm:w-11 ${TILE_TONES[index % TILE_TONES.length]}`}>
                <Icon name={item.icon} />
              </span>
              <span>
                <span className="block font-bold">{item.title}</span>
                <span className="hidden text-sm text-ink-soft sm:block">{item.tagline}</span>
              </span>
              {selected && autoplay && (
                <span
                  aria-hidden
                  key={`progress-${active}`}
                  className="showcase-progress absolute bottom-0 left-0 h-0.5 bg-violet"
                  style={{ animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                />
              )}
            </button>
          );
        })}
        <a
          href={ctaHref}
          className="mt-auto hidden rounded-xl border border-dashed border-violet/40 p-4 text-sm transition-colors hover:bg-violet-tint lg:block"
        >
          <span className="flex items-center gap-2 font-bold text-violet">
            <Icon name="upload" size={16} /> Try it with your notes
          </span>
          <span className="mt-1 block text-ink-soft">Upload a PDF, text or Markdown file and get all four in seconds.</span>
        </a>
      </div>

      <div
        role="tabpanel"
        id="showcase-panel"
        aria-labelledby={`showcase-tab-${tool.id}`}
        className="bg-dots relative bg-paper p-5 sm:p-8"
      >
        <div aria-hidden className="mx-auto mb-5 flex max-w-xl flex-wrap items-center justify-center gap-2 text-xs font-bold">
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5">
            <span className="rounded bg-bad-tint px-1 text-[10px] text-bad">PDF</span>
            {SAMPLE_FILE}
          </span>
          <Icon name="arrow" size={16} className="text-ink-soft" />
          <span className="bg-brand flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <Icon name="sparkle" size={13} />
            {tool.title}
          </span>
        </div>

        <div key={tool.id} className="showcase-in mx-auto max-w-xl">
          <div aria-hidden className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-lift)] sm:min-h-[340px] sm:p-6">
            <tool.Preview />
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            {tool.points.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Icon name="check" size={15} className="text-good" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Hero illustration: the tutor answering with a hint, a flashcard and today's plan, layered. */
export function HeroCollage() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-lg sm:pt-6 sm:pr-6 sm:pb-28">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand">
            <Icon name="sparkle" size={14} />
          </span>
          <span className="text-sm font-bold">AI Tutor · Practice</span>
        </div>
        <div className="space-y-3 p-5 font-mono text-sm">
          <p className="text-ink-soft"># What will this print?</p>
          <pre className="rounded-lg bg-code px-4 py-3 text-code-fg">
            <span className="text-[#b791ff]">for</span> i <span className="text-[#b791ff]">in</span> range(3):{"\n"}
            {"    "}print(i)
          </pre>
          <div className="rounded-lg border border-line px-4 py-2.5">
            <p className="text-xs text-ink-soft">Your answer</p>
            <p>1 2 3</p>
          </div>
        </div>
        <div className="border-t-4 border-sun bg-sun-tint px-5 py-4">
          <p className="text-sm font-bold">Hint</p>
          <p className="mt-1 text-sm">
            Close! Think about where <code className="font-mono text-blue-deep">range(3)</code> starts counting.
          </p>
        </div>
      </div>

      <div className="absolute top-0 -right-4 hidden w-44 rotate-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)] sm:block">
        <p className="text-[10px] font-bold tracking-wide text-ink-soft uppercase">Flashcard · 4 of 12</p>
        <p className="mt-1 text-sm font-bold">What does len() return?</p>
      </div>

      <div className="absolute bottom-0 -left-10 hidden w-52 -rotate-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)] sm:block">
        <p className="text-xs font-bold">📅 Today&apos;s plan · 2/3</p>
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="flex items-center gap-1.5 text-ink-soft line-through">
            <Icon name="check" size={12} className="text-good" /> Read: Loops
          </p>
          <p className="flex items-center gap-1.5 text-ink-soft line-through">
            <Icon name="check" size={12} className="text-good" /> Learn: Loops
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-line" /> Practice Loops
          </p>
        </div>
      </div>
    </div>
  );
}