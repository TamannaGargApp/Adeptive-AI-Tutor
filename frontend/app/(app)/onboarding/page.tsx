"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { Alert, CompletionBar } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { GOAL_LABELS, LEVEL_LABELS, LEVELS } from "@/lib/labels";
import type { LearningGoal, Level, Subject } from "@/lib/types";

type StartChoice = "plan" | "course";
const START_OPTIONS: StartChoice[] = ["plan", "course"];
const START_LABELS: Record<StartChoice, string> = {
  plan: "Create a personalized study plan",
  course: "Choose a course to start",
};
const START_HINTS: Record<StartChoice, string> = {
  plan: "Tell us your goal; we'll suggest courses and build a schedule you can adjust",
  course: "Pick a course and learn at your own pace",
};
const START_ICONS: Record<StartChoice, IconName> = { plan: "calendar", course: "compass" };

const GOALS = Object.keys(GOAL_LABELS) as LearningGoal[];
const GOAL_HINTS: Record<LearningGoal, string> = {
  learn_python: "Start from the basics of a language",
  improve_problem_solving: "Get better at breaking problems down",
  interview_preparation: "Practise the questions interviews ask",
};
const GOAL_ICONS: Record<LearningGoal, IconName> = {
  learn_python: "book",
  improve_problem_solving: "target",
  interview_preparation: "trophy",
};

const LEVEL_HINTS: Record<Level, string> = {
  beginner: "New to programming",
  intermediate: "Comfortable with the basics",
  advanced: "Writing code regularly",
};
const LEVEL_ICONS: Record<Level, IconName> = { beginner: "sparkle", intermediate: "layers", advanced: "bolt" };
const DIFFICULTY_HINTS: Record<Level, string> = {
  beginner: "Gentle steps and lots of hints",
  intermediate: "A steady challenge",
  advanced: "Stretch me with harder problems",
};

/** Three bars, filled up to the level: a quick visual for difficulty. */
function LevelBars({ level }: { level: Level }) {
  const filled = LEVELS.indexOf(level) + 1;
  return (
    <span aria-hidden className="flex h-5 items-end gap-0.5">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={`w-1.5 rounded-full ${bar <= filled ? "bg-current" : "bg-current opacity-25"}`}
          style={{ height: `${bar * 6 + 2}px` }}
        />
      ))}
    </span>
  );
}

interface ChoiceGroupProps<T extends string> {
  name: string;
  options: T[];
  labels: Record<T, string>;
  hints?: Record<T, string>;
  icons?: Record<T, IconName>;
  bars?: boolean;
  columns?: 2 | 3;
  value: T | null;
  onChange: (value: T) => void;
  legend: string;
}

/** Radio buttons styled as cards. The real inputs stay in the page for keyboard and screen readers. */
function ChoiceGroup<T extends string>({
  name,
  options,
  labels,
  hints,
  icons,
  bars,
  columns = 3,
  value,
  onChange,
  legend,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={`grid gap-3 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <label
              key={option}
              className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet ${
                selected
                  ? "border-violet bg-violet-tint/60 shadow-[0_8px_24px_-14px_rgb(123_52_230/0.7)]"
                  : "border-line bg-surface hover:-translate-y-0.5 hover:border-violet/40"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {(icons || bars) && (
                <span
                  aria-hidden
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors ${
                    selected ? "bg-brand" : "bg-violet-tint text-violet"
                  }`}
                >
                  {bars ? <LevelBars level={option as Level} /> : <Icon name={icons![option]} size={19} />}
                </span>
              )}
              <span className="min-w-0 flex-1 pr-5">
                <span className="block font-bold">{labels[option]}</span>
                {hints && <span className="mt-0.5 block text-sm text-ink-soft">{hints[option]}</span>}
              </span>
              <span
                aria-hidden
                className={`absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full border-2 transition-colors ${
                  selected ? "bg-brand border-transparent" : "border-line"
                }`}
              >
                {selected && <Icon name="check" size={11} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One numbered question card. */
function Step({
  number,
  title,
  hint,
  done,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5 sm:p-6" aria-label={title}>
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors ${
            done ? "bg-good text-on-accent" : "bg-violet-tint text-violet"
          }`}
        >
          {done ? <Icon name="check" size={15} /> : number}
        </span>
        <div>
          <h2 className="text-lg leading-tight font-bold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [level, setLevel] = useState<Level | null>(user?.level ?? null);
  const [goal, setGoal] = useState<LearningGoal | null>(user?.goal ?? null);
  const [difficulty, setDifficulty] = useState<Level | null>(user?.preferred_difficulty ?? null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subject, setSubject] = useState<string | null>(user?.current_subject ?? null);
  // A study plan is optional: learners can build one from a goal, or simply pick a course.
  const [start, setStart] = useState<StartChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSubjects()
      .then(setSubjects)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const startDone = start === "plan" || (start === "course" && Boolean(subject));
  const answered = [Boolean(name.trim()), Boolean(level), Boolean(goal), Boolean(difficulty), startDone];
  const answeredCount = answered.filter(Boolean).length;
  const ready = answeredCount === answered.length;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !level || !goal || !difficulty || !start || (start === "course" && !subject)) {
      setError("Fill in your name and pick one option in each section.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        name: name.trim(),
        level,
        goal,
        preferred_difficulty: difficulty,
        subject_slug: start === "course" ? (subject ?? undefined) : undefined,
      });
      setUser(updated);
      router.replace(start === "plan" ? "/study-plan" : "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const firstName = name.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      {/* Welcome */}
      {/* Open hero (no box), like the landing page. */}
      <header className="relative px-2 pt-4 pb-6 text-center">
        <div className="relative">
          <span className="bg-brand mx-auto grid h-14 w-14 place-items-center rounded-2xl shadow-[0_10px_24px_-10px_rgb(91_62_230/0.7)]">
            <Icon name="sparkle" size={26} />
          </span>
          <p className="mt-4 text-xs font-bold tracking-wider text-violet uppercase">Welcome{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            Let&apos;s set up <span className="text-gradient">your tutor</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-ink-soft">
            Five quick questions so explanations, hints and practice match how you learn. You can change any of this
            later in your profile.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}

        <Step number={1} title="What should we call you?" done={answered[0]}>
          <div className="relative max-w-md">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft">
              <Icon name="user" size={18} />
            </span>
            <label htmlFor="name" className="sr-only">
              Name
            </label>
            <input
              id="name"
              className="input pl-11"
              placeholder="Your name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </Step>

        <Step number={2} title="Your current programming level" hint="So explanations start in the right place." done={answered[1]}>
          <ChoiceGroup
            name="level"
            legend="Current programming level"
            options={LEVELS}
            labels={LEVEL_LABELS}
            hints={LEVEL_HINTS}
            icons={LEVEL_ICONS}
            value={level}
            onChange={setLevel}
          />
        </Step>

        <Step number={3} title="Your learning goal" hint="We'll lean examples and practice towards it." done={answered[2]}>
          <ChoiceGroup
            name="goal"
            legend="Learning goal"
            options={GOALS}
            labels={GOAL_LABELS}
            hints={GOAL_HINTS}
            icons={GOAL_ICONS}
            value={goal}
            onChange={setGoal}
          />
        </Step>

        <Step
          number={4}
          title="Preferred difficulty"
          hint="Where questions start. It adjusts automatically as you practise."
          done={answered[3]}
        >
          <ChoiceGroup
            name="difficulty"
            legend="Preferred difficulty"
            options={LEVELS}
            labels={LEVEL_LABELS}
            hints={DIFFICULTY_HINTS}
            bars
            value={difficulty}
            onChange={setDifficulty}
          />
        </Step>

        <Step number={5} title="How would you like to start?" done={answered[4]}>
          <ChoiceGroup
            name="start"
            legend="How would you like to start?"
            options={START_OPTIONS}
            labels={START_LABELS}
            hints={START_HINTS}
            icons={START_ICONS}
            columns={2}
            value={start}
            onChange={setStart}
          />

          {start === "course" && subjects.length > 0 && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-3 font-bold">Which course first?</p>
              <ChoiceGroup
                name="subject"
                legend="Which course first?"
                options={subjects.map((item) => item.slug)}
                labels={Object.fromEntries(subjects.map((item) => [item.slug, item.name]))}
                hints={Object.fromEntries(subjects.map((item) => [item.slug, item.description]))}
                icons={Object.fromEntries(
                  subjects.map((item) => [item.slug, item.slug.includes("javascript") ? "bolt" : "code"]),
                ) as Record<string, IconName>}
                columns={subjects.length === 2 ? 2 : 3}
                value={subject}
                onChange={setSubject}
              />
            </div>
          )}
        </Step>

        {/* Progress and submit, kept in view while scrolling */}
        <div className="sticky bottom-4 z-10">
          <div className="panel flex flex-wrap items-center gap-4 p-4 shadow-[var(--shadow-lift)]">
            <div className="min-w-0 flex-1 basis-48">
              <p className="mb-1.5 text-sm">
                <span className="font-bold">
                  {answeredCount} of {answered.length}
                </span>{" "}
                <span className="text-ink-soft">{ready ? "All set!" : "answered"}</span>
              </p>
              <CompletionBar percent={Math.round((answeredCount / answered.length) * 100)} label="Questions answered" />
            </div>
            <button type="submit" className="btn btn-primary px-6" disabled={saving}>
              {saving ? "Saving…" : start === "plan" ? "Continue to my study plan" : "Save and continue"}
              {!saving && <Icon name="arrow" size={17} />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
