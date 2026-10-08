"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { parseLocalDate, planTaskLink, WEEKDAY_LABELS } from "@/lib/labels";
import type { PlanPhase, PlanSettings, PlanTask, StudyPlan } from "@/lib/types";

import { Icon, type IconName } from "./Icon";
import { CompletionBar } from "./ui";

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" };
const SHORT_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120];

export function formatPlanDate(day: string): string {
  return parseLocalDate(day).toLocaleDateString(undefined, DAY_FORMAT);
}

function shortDate(day: string): string {
  return parseLocalDate(day).toLocaleDateString(undefined, SHORT_FORMAT);
}

export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const TASK_ICONS: Record<PlanTask["type"], IconName> = {
  read: "book",
  learn: "chat",
  practice: "target",
  quiz: "quiz",
  final_test: "trophy",
  course_exam: "shield",
};

/** One task: tick box, what to do, and a Start button that opens the right page in the right course. */
export function PlanTaskItem({ task, onToggle }: { task: PlanTask; onToggle?: (task: PlanTask) => void }) {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  async function start() {
    // Tutor and test pages show the current course, so switch to this task's course first.
    if (user && task.subject_slug !== user.current_subject) {
      setOpening(true);
      try {
        setUser(await api.setCurrentSubject(task.subject_slug));
      } catch {
        // Still try to open the page.
      }
    }
    router.push(planTaskLink(task));
  }

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        task.done ? "border-transparent bg-paper" : "border-line bg-surface hover:border-violet/40"
      }`}
    >
      {onToggle && (
        <input
          type="checkbox"
          checked={task.done}
          disabled={task.auto_done}
          onChange={() => onToggle(task)}
          aria-label={`Mark "${task.title}" as ${task.done ? "not done" : "done"}`}
          className="h-[18px] w-[18px] shrink-0 accent-violet"
        />
      )}
      <span
        aria-hidden
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${task.done ? "bg-good-tint text-good" : "bg-violet-tint text-violet"}`}
      >
        <Icon name={task.done ? "check" : TASK_ICONS[task.type]} size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${task.done ? "text-ink-soft line-through" : ""}`}>
          {task.title}
          <span className="ml-2 inline-block rounded-md bg-blue-tint px-1.5 py-0.5 align-middle text-[11px] text-blue-deep">
            {task.subject_name}
          </span>
        </p>
        <p className="text-sm text-ink-soft">
          {task.detail} · {task.minutes} min
          {task.auto_done ? " · ✓ Passed" : ""}
        </p>
      </div>
      {onToggle && !task.done && (
        <button type="button" onClick={start} disabled={opening} className="btn btn-secondary shrink-0 px-3 py-1 text-sm">
          {opening ? "Opening…" : "Start"}
        </button>
      )}
    </li>
  );
}

/** Today's tasks, or when the next study day is. Used on the dashboard and the plan page. */
export function TodayPlanCard({
  plan,
  onToggle,
  compact = false,
}: {
  plan: StudyPlan;
  onToggle: (task: PlanTask) => void;
  compact?: boolean;
}) {
  const today = plan.days.find((day) => day.date === plan.today);
  const next = plan.days.find((day) => day.date > plan.today && day.tasks.some((task) => !task.done));
  const allDone = plan.total_tasks > 0 && plan.done_tasks === plan.total_tasks;
  const doneToday = today?.tasks.filter((task) => task.done).length ?? 0;
  const totalToday = today?.tasks.length ?? 0;

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="today-plan-heading">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="icon-tile h-11 w-11 bg-sun-tint text-ink">
          <Icon name="calendar" size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="today-plan-heading" className="text-lg font-bold">
            Today&apos;s plan
          </h2>
          <p className="text-sm text-ink-soft">
            {totalToday ? `${doneToday} of ${totalToday} done today` : "No study scheduled today"} · {plan.done_tasks} of{" "}
            {plan.total_tasks} in the whole plan
          </p>
        </div>
        {compact && (
          <Link href="/study-plan" className="btn btn-secondary px-3 py-1.5 text-sm">
            Full plan
          </Link>
        )}
      </div>
      {totalToday > 0 && (
        <div className="mt-4">
          <CompletionBar percent={Math.round((doneToday / totalToday) * 100)} label="Today's tasks done" />
        </div>
      )}
      {allDone ? (
        <p className="mt-2">Every task in your plan is done. Brilliant work!</p>
      ) : today ? (
        <ul className="mt-3 space-y-2">
          {today.tasks.map((task) => (
            <PlanTaskItem key={task.id} task={task} onToggle={onToggle} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-ink">
          Nothing scheduled today.{next ? ` Your next session is ${formatPlanDate(next.date)}.` : ""}
        </p>
      )}
      {plan.overdue_tasks > 0 && (
        <p className="mt-3 text-sm font-bold text-bad">
          {plan.overdue_tasks} unfinished task{plan.overdue_tasks === 1 ? "" : "s"} from earlier days.{" "}
          {compact ? (
            <Link href="/study-plan" className="underline">
              Replan
            </Link>
          ) : (
            "Use Replan from today to rebuild your schedule."
          )}
        </p>
      )}
    </section>
  );
}

const PHASE_COLORS = ["bg-blue", "bg-violet", "bg-cyan", "bg-magenta", "bg-sun"];

/** The plan's phases, e.g. "Oct 6 – Oct 26: Python 100%", with a bar showing each course's share. */
export function PhaseTimeline({ phases, courseOrder }: { phases: PlanPhase[]; courseOrder: string[] }) {
  const colorOf = (slug: string) => PHASE_COLORS[Math.max(0, courseOrder.indexOf(slug)) % PHASE_COLORS.length];
  if (phases.length === 0) return <p className="text-sm text-ink-soft">Nothing left to schedule.</p>;
  return (
    <ol className="space-y-3">
      {phases.map((phase) => (
        <li key={phase.start_date}>
          <p className="text-sm font-bold">
            {shortDate(phase.start_date)} – {shortDate(phase.end_date)}
            <span className="ml-2 font-normal text-ink-soft">
              {phase.shares.map((share) => `${share.subject_name} ${share.percent}%`).join(" · ")}
            </span>
          </p>
          <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-paper" aria-hidden>
            {phase.shares.map((share) => (
              <div key={share.subject_slug} className={colorOf(share.subject_slug)} style={{ width: `${share.percent}%` }} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Study days, time per day and an optional deadline. */
export function ScheduleControls({
  settings,
  onChange,
  disabled,
}: {
  settings: PlanSettings;
  onChange: (settings: PlanSettings) => void;
  disabled?: boolean;
}) {
  function toggleDay(day: number) {
    const days = settings.study_days.includes(day)
      ? settings.study_days.filter((item) => item !== day)
      : [...settings.study_days, day].sort();
    if (days.length) onChange({ ...settings, study_days: days });
  }

  return (
    <div className="space-y-5">
      <fieldset disabled={disabled}>
        <legend className="mb-2 font-bold">Days I can study</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, day) => {
            const selected = settings.study_days.includes(day);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={selected}
                className={`h-10 w-14 rounded-lg border text-sm font-bold ${
                  selected ? "border-blue bg-blue text-on-accent" : "border-line text-ink-soft hover:border-blue/50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-1.5">
          <label htmlFor="plan-minutes" className="block font-bold">
            Time per study day
          </label>
          <select
            id="plan-minutes"
            className="input w-auto pr-8"
            disabled={disabled}
            value={settings.minutes_per_day}
            onChange={(event) => onChange({ ...settings, minutes_per_day: Number(event.target.value) })}
          >
            {MINUTE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="plan-deadline" className="block font-bold">
            Deadline <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="plan-deadline"
              type="date"
              className="input w-auto"
              disabled={disabled}
              min={isoDate(new Date())}
              value={settings.target_date ?? ""}
              onChange={(event) => onChange({ ...settings, target_date: event.target.value || null })}
            />
            {settings.target_date && (
              <button
                type="button"
                className="text-sm font-bold text-blue hover:text-blue-deep"
                onClick={() => onChange({ ...settings, target_date: null })}
              >
                No deadline
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}