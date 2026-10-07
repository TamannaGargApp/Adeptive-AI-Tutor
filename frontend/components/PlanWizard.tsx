"use client";

import { useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LEVEL_LABELS, LEVELS } from "@/lib/labels";
import type { CourseSuggestion, Level, PlanDraft, PlanSettings, StudyPlan, Subject } from "@/lib/types";

import { formatPlanDate, PhaseTimeline, PlanTaskItem, ScheduleControls } from "./StudyPlan";
import { Alert, Spinner } from "./ui";
import WaitingMessage from "./WaitingMessage";

/** How the planner was opened: a new plan, editing the current one, or adding/removing one course. */
export type WizardMode = { kind: "new" } | { kind: "edit" } | { kind: "add"; slug: string } | { kind: "remove"; slug: string };

type Step = "goal" | "courses" | "time" | "draft";

interface ChatEntry {
  from: "learner" | "planner";
  text: string;
}

const EXAMPLE_GOALS = [
  "Learn Python from scratch",
  "Learn Python and JavaScript to build web apps",
  "Prepare for a Python job interview",
];

const DEFAULT_SETTINGS: PlanSettings = { study_days: [0, 1, 2, 3, 4], minutes_per_day: 45, target_date: null };
const STEP_LABELS: Record<Step, string> = { goal: "Goal", courses: "Courses", time: "Time", draft: "Your plan" };
const STEPS: Step[] = ["goal", "courses", "time", "draft"];

export default function PlanWizard({
  plan,
  mode,
  onAccepted,
  onCancel,
}: {
  plan: StudyPlan | null;
  mode: WizardMode;
  onAccepted: (plan: StudyPlan) => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(mode.kind === "new" ? "goal" : "draft");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [level, setLevel] = useState<Level>(plan?.level ?? user?.level ?? "beginner");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [suggestion, setSuggestion] = useState<CourseSuggestion | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [settings, setSettings] = useState<PlanSettings>(plan?.settings ?? DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const nameOf = (slug: string) => subjects.find((subject) => subject.slug === slug)?.name ?? slug;

  useEffect(() => {
    api
      .getSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  // Editing, adding or removing a course goes straight to a draft of the changed plan.
  useEffect(() => {
    if (mode.kind === "new" || !plan || startedRef.current) return;
    startedRef.current = true;
    const current = plan.strategy.courses.map((course) => course.subject_slug);
    if (mode.kind === "edit") {
      void requestDraft(current, plan.settings, { strategy: plan.strategy });
    } else if (mode.kind === "remove") {
      const courses = current.filter((slug) => slug !== mode.slug);
      const strategy = { ...plan.strategy, courses: plan.strategy.courses.filter((c) => c.subject_slug !== mode.slug) };
      void requestDraft(courses, plan.settings, { strategy, note: "Here's your plan without that course." });
    } else {
      const courses = current.includes(mode.slug) ? current : [...current, mode.slug];
      void requestDraft(courses, plan.settings, {
        strategy: plan.strategy,
        change: `Add the ${mode.slug} course to my plan, fitting it in sensibly with what's already there.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, plan]);

  async function suggestCourses() {
    await run("Finding the right courses for your goal…", async () => {
      const result = await api.suggestPlanCourses({ goal, level });
      setSuggestion(result);
      // Suggested courses start selected; anything else the learner has stays separate unless they tick it.
      setSelected(result.courses.map((course) => course.subject_slug));
      setStep("courses");
    });
  }

  async function requestDraft(
    courses: string[],
    nextSettings: PlanSettings,
    options: { strategy?: PlanDraft["strategy"]; change?: string; note?: string } = {},
  ) {
    await run(options.change ? "Updating your plan…" : "Building your plan…", async () => {
      const result = await api.draftStudyPlan({
        goal: plan?.goal ?? goal,
        level: plan?.level ?? level,
        courses,
        settings: nextSettings,
        strategy: options.strategy ?? null,
        change_request: options.change ?? null,
      });
      setDraft(result);
      setSettings(result.settings);
      setStep("draft");
      const reply = result.changes_explained || options.note;
      if (reply) setChat((current) => [...current, { from: "planner", text: reply }]);
    });
  }

  async function sendChange() {
    const text = message.trim();
    if (!text || !draft) return;
    setMessage("");
    setChat((current) => [...current, { from: "learner", text }]);
    await requestDraft(draft.courses, draft.settings, { strategy: draft.strategy, change: text });
  }

  async function accept() {
    if (!draft) return;
    await run("Saving your plan…", async () => onAccepted(await api.acceptStudyPlan(draft)));
  }

  const otherCourses = subjects.filter((subject) => !suggestion?.courses.some((course) => course.subject_slug === subject.slug));

  return (
    <div className="space-y-6">
      {mode.kind === "new" && (
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Planning steps">
          {STEPS.map((item, index) => (
            <li
              key={item}
              aria-current={item === step ? "step" : undefined}
              className={`rounded-full px-3 py-1 font-bold ${
                item === step ? "bg-blue text-on-accent" : STEPS.indexOf(step) > index ? "bg-blue-tint text-blue-deep" : "bg-paper text-ink-soft"
              }`}
            >
              {index + 1}. {STEP_LABELS[item]}
            </li>
          ))}
        </ol>
      )}

      {error && <Alert>{error}</Alert>}
      {busy && <WaitingMessage label={busy} />}

      {step === "goal" && !busy && (
        <section className="panel space-y-5 p-6">
          <div className="space-y-1.5">
            <label htmlFor="plan-goal" className="block text-lg font-bold">
              What do you want to achieve?
            </label>
            <textarea
              id="plan-goal"
              className="input"
              rows={3}
              maxLength={500}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="For example: learn Python and JavaScript so I can build web apps"
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_GOALS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setGoal(example)}
                  className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-blue hover:text-blue-deep"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="plan-level" className="block font-bold">
              Your current level
            </label>
            <select id="plan-level" className="input w-auto pr-8" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((item) => (
                <option key={item} value={item}>
                  {LEVEL_LABELS[item]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={goal.trim().length < 3} onClick={suggestCourses}>
              Suggest courses
            </button>
            {onCancel && (
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </section>
      )}

      {step === "courses" && suggestion && !busy && (
        <section className="panel space-y-5 p-6">
          <p className="text-lg">{suggestion.message}</p>
          {suggestion.not_available.length > 0 && (
            <Alert kind="info">Not available as a course yet: {suggestion.not_available.join(", ")}.</Alert>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1 font-bold">Suggested for your goal</legend>
            {suggestion.courses.length === 0 && (
              <p className="text-sm text-ink-soft">None of the current courses fits this goal closely; you can still pick any below.</p>
            )}
            {suggestion.courses.map((course) => (
              <CourseChoice
                key={course.subject_slug}
                name={nameOf(course.subject_slug)}
                detail={`${course.role}: ${course.reason}`}
                checked={selected.includes(course.subject_slug)}
                onToggle={() => toggle(course.subject_slug)}
              />
            ))}
          </fieldset>
          {otherCourses.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-1 font-bold">Other courses</legend>
              <p className="text-sm text-ink-soft">
                Tick any you&apos;d like in this plan. Courses you don&apos;t tick stay on their own if you already study them.
              </p>
              {otherCourses.map((subject) => (
                <CourseChoice
                  key={subject.slug}
                  name={subject.name}
                  detail={subject.in_plan ? "Already in My courses" : subject.description}
                  checked={selected.includes(subject.slug)}
                  onToggle={() => toggle(subject.slug)}
                />
              ))}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={selected.length === 0} onClick={() => setStep("time")}>
              Continue
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("goal")}>
              Back
            </button>
          </div>
        </section>
      )}

      {step === "time" && !busy && (
        <section className="panel space-y-5 p-6">
          <div>
            <h2 className="text-lg font-bold">How much time do you have?</h2>
            <p className="text-sm text-ink-soft">
              Set a deadline, or leave it empty and we&apos;ll show when you&apos;d finish at this pace. You can change
              everything on the next screen.
            </p>
          </div>
          <ScheduleControls settings={settings} onChange={setSettings} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => requestDraft(selected, settings)}>
              Build my plan
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("courses")}>
              Back
            </button>
          </div>
        </section>
      )}

      {step === "draft" && draft && (
        <DraftReview
          draft={draft}
          nameOf={nameOf}
          chat={chat}
          message={message}
          busy={busy !== null}
          onMessageChange={setMessage}
          onSend={sendChange}
          onScheduleChange={(next) => requestDraft(draft.courses, next, { strategy: draft.strategy })}
          onAccept={accept}
          onCancel={onCancel}
        />
      )}
      {step === "draft" && !draft && !busy && !error && <Spinner />}
    </div>
  );

  function toggle(slug: string) {
    setSelected((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
  }
}

function CourseChoice({ name, detail, checked, onToggle }: { name: string; detail: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 ${checked ? "border-blue bg-blue-tint" : "border-line"}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 accent-blue" />
      <span>
        <span className="block font-bold">{name}</span>
        <span className="text-sm text-ink-soft">{detail}</span>
      </span>
    </label>
  );
}

function DraftReview({
  draft,
  nameOf,
  chat,
  message,
  busy,
  onMessageChange,
  onSend,
  onScheduleChange,
  onAccept,
  onCancel,
}: {
  draft: PlanDraft;
  nameOf: (slug: string) => string;
  chat: ChatEntry[];
  message: string;
  busy: boolean;
  onMessageChange: (text: string) => void;
  onSend: () => void;
  onScheduleChange: (settings: PlanSettings) => void;
  onAccept: () => void;
  onCancel?: () => void;
}) {
  const [settings, setSettings] = useState(draft.settings);
  useEffect(() => setSettings(draft.settings), [draft.settings]);
  const scheduleChanged = JSON.stringify(settings) !== JSON.stringify(draft.settings);
  const order = draft.strategy.courses.map((course) => course.subject_slug);
  const progressOf = (slug: string) =>
    draft.course_details.find((course) => course.subject_slug === slug)?.completion_percent ?? 0;

  return (
    <div className="space-y-5">
      <section className="panel space-y-4 p-6" aria-labelledby="draft-heading">
        <div>
          <p className="text-sm font-bold text-ink-soft">Draft plan · not saved yet</p>
          <h2 id="draft-heading" className="text-2xl font-bold">
            {draft.goal}
          </h2>
        </div>
        <p>{draft.strategy.summary}</p>

        <ol className="space-y-2">
          {draft.strategy.courses.map((course, index) => (
            <li key={course.subject_slug} className="rounded-lg border border-line px-4 py-3">
              <p className="font-bold">
                {index + 1}. {nameOf(course.subject_slug)}
                {progressOf(course.subject_slug) > 0 && (
                  <span className="ml-2 text-sm font-normal text-good">
                    {progressOf(course.subject_slug)}% already complete; only what&apos;s left is scheduled
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-soft">{course.reason}</p>
              {course.depends_on.length > 0 && (
                <p className="mt-1 text-xs font-bold text-ink-soft">
                  Starts{" "}
                  {course.start_after_topics < 0
                    ? `after ${course.depends_on.map(nameOf).join(" and ")} is finished`
                    : `after ${course.start_after_topics} topic${course.start_after_topics === 1 ? "" : "s"} of ${course.depends_on
                        .map(nameOf)
                        .join(" and ")}`}
                </p>
              )}
            </li>
          ))}
        </ol>
        {draft.strategy.courses.length > 1 && (
          <p className="text-sm text-ink-soft">
            <span className="font-bold">
              {draft.strategy.day_sharing === "alternate" ? "Alternating days" : "Sharing each study day"}:
            </span>{" "}
            {draft.strategy.day_sharing_reason}
          </p>
        )}

        <div>
          <h3 className="mb-2 font-bold">Timeline</h3>
          <PhaseTimeline phases={draft.phases} courseOrder={order} />
        </div>
        <p className={`text-sm font-bold ${draft.fits ? "text-good" : "text-bad"}`}>
          {draft.finish_date
            ? draft.fits
              ? `${draft.total_tasks} tasks, finishing ${formatPlanDate(draft.finish_date)}.`
              : `At this pace you'd finish ${formatPlanDate(draft.finish_date)}, after your deadline. Add study days or time, move the deadline, or ask for a lighter plan below.`
            : "There's nothing left to schedule for these courses."}
        </p>
      </section>

      {draft.preview_days.length > 0 && (
        <section className="panel space-y-3 p-6" aria-labelledby="preview-heading">
          <h3 id="preview-heading" className="font-bold">
            Your first sessions
          </h3>
          {draft.preview_days.map((day) => (
            <div key={day.date}>
              <p className="mb-1 text-sm font-bold text-ink-soft">{formatPlanDate(day.date)}</p>
              <ul className="space-y-1.5">
                {day.tasks.map((task) => (
                  <PlanTaskItem key={task.id} task={task} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="panel space-y-4 p-6" aria-labelledby="adjust-heading">
        <h3 id="adjust-heading" className="font-bold">
          Adjust the schedule
        </h3>
        <ScheduleControls settings={settings} onChange={setSettings} disabled={busy} />
        {scheduleChanged && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onScheduleChange(settings)}>
            Update the schedule
          </button>
        )}
      </section>

      <section className="panel space-y-3 p-6" aria-labelledby="chat-heading">
        <h3 id="chat-heading" className="font-bold">
          Want changes? Just ask.
        </h3>
        {chat.length > 0 && (
          <ul className="space-y-2" aria-live="polite">
            {chat.map((entry, index) => (
              <li key={index} className={entry.from === "learner" ? "flex justify-end" : ""}>
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    entry.from === "learner" ? "bg-blue text-on-accent" : "border border-line bg-paper"
                  }`}
                >
                  {entry.text}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <label htmlFor="plan-change" className="sr-only">
            Ask for a change
          </label>
          <input
            id="plan-change"
            className="input"
            maxLength={500}
            value={message}
            disabled={busy}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder='e.g. "No weekends", "Finish JavaScript sooner", "More time on Python"'
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !message.trim()}>
            Send
          </button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary px-6" disabled={busy} onClick={onAccept}>
          Accept plan
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}