"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui";
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

const GOALS = Object.keys(GOAL_LABELS) as LearningGoal[];

const LEVEL_HINTS: Record<Level, string> = {
  beginner: "New to programming",
  intermediate: "Comfortable with the basics",
  advanced: "Writing code regularly",
};

interface ChoiceGroupProps<T extends string> {
  name: string;
  legend: string;
  options: T[];
  labels: Record<T, string>;
  hints?: Record<T, string>;
  value: T | null;
  onChange: (value: T) => void;
}

function ChoiceGroup<T extends string>({ name, legend, options, labels, hints, value, onChange }: ChoiceGroupProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-lg border px-4 py-3 ${
              value === option ? "border-blue bg-blue-tint" : "border-line bg-surface hover:border-blue/50"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span className="block font-bold">{labels[option]}</span>
            {hints && <span className="mt-0.5 block text-sm text-ink-soft">{hints[option]}</span>}
          </label>
        ))}
      </div>
    </fieldset>
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Tell us about yourself</h1>
      <p className="mt-2 text-ink-soft">Your tutor uses this to pitch explanations and questions at the right level.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {error && <Alert>{error}</Alert>}

        <div className="max-w-sm space-y-1.5">
          <label htmlFor="name" className="block font-bold">
            Name
          </label>
          <input id="name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <ChoiceGroup
          name="level"
          legend="Current programming level"
          options={LEVELS}
          labels={LEVEL_LABELS}
          hints={LEVEL_HINTS}
          value={level}
          onChange={setLevel}
        />
        <ChoiceGroup name="goal" legend="Learning goal" options={GOALS} labels={GOAL_LABELS} value={goal} onChange={setGoal} />
        <ChoiceGroup
          name="difficulty"
          legend="Preferred difficulty"
          options={LEVELS}
          labels={LEVEL_LABELS}
          value={difficulty}
          onChange={setDifficulty}
        />

        <ChoiceGroup
          name="start"
          legend="How would you like to start?"
          options={START_OPTIONS}
          labels={START_LABELS}
          hints={START_HINTS}
          value={start}
          onChange={setStart}
        />

        {start === "course" && subjects.length > 0 && (
          <ChoiceGroup
            name="subject"
            legend="Which course first?"
            options={subjects.map((item) => item.slug)}
            labels={Object.fromEntries(subjects.map((item) => [item.slug, item.name]))}
            hints={Object.fromEntries(subjects.map((item) => [item.slug, item.description]))}
            value={subject}
            onChange={setSubject}
          />
        )}

        <button type="submit" className="btn btn-primary px-6" disabled={saving}>
          {saving ? "Saving…" : start === "plan" ? "Continue to my study plan" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}