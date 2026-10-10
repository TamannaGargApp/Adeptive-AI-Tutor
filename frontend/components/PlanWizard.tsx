"use client";

import { useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LEVEL_LABELS, LEVELS } from "@/lib/labels";
import type { CourseSuggestion, Level, PlanDraft, PlanSettings, StudyPlan, Subject } from "@/lib/types";

import { Icon, type IconName } from "./Icon";
import { formatPlanDate, PhaseTimeline, PlanTaskItem, ScheduleControls } from "./StudyPlan";
import { Alert, Segmented, Spinner } from "./ui";
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
const STEP_ICONS: Record<Step, IconName> = { goal: "target", courses: "layers", time: "clock", draft: "calendar" };
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
      {mode.kind === "new" && <Stepper step={step} />}

      {error && <Alert>{error}</Alert>}
      {busy && <WaitingMessage label={busy} />}

      {step === "goal" && !busy && (
        <section className="panel space-y-6 p-6 sm:p-7">
          <StepTitle icon="target" title="What do you want to achieve?" text="Describe it in your own words. We'll suggest the right courses." />
          <div className="space-y-3">
            <label htmlFor="plan-goal" className="sr-only">
              Your goal
            </label>
            <textarea
              id="plan-goal"
              className="input min-h-28 text-base"
              rows={3}
              maxLength={500}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="For example: learn Python and JavaScript so I can build web apps"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-ink-soft uppercase">Try</span>
              {EXAMPLE_GOALS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setGoal(example)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    goal === example
                      ? "border-violet bg-violet-tint text-violet"
                      : "border-line text-ink-soft hover:border-violet/50 hover:text-ink"
                  }`}
                >
                  <Icon name="sparkle" size={13} /> {example}
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-md space-y-2">
            <p className="font-bold">Your current level</p>
            <Segmented<Level>
              label="Your current level"
              value={level}
              onChange={setLevel}
              options={LEVELS.map((item) => ({ value: item, label: LEVEL_LABELS[item] }))}
            />
          </div>
          <StepActions>
            <button type="button" className="btn btn-primary" disabled={goal.trim().length < 3} onClick={suggestCourses}>
              Suggest courses <Icon name="arrow" size={17} />
            </button>
            {onCancel && (
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            )}
          </StepActions>
        </section>
      )}

      {step === "courses" && suggestion && !busy && (
        <section className="panel space-y-6 p-6 sm:p-7">
          <PlannerSays text={suggestion.message} />
          {suggestion.not_available.length > 0 && (
            <Alert kind="info">Not available as a course yet: {suggestion.not_available.join(", ")}.</Alert>
          )}
          <fieldset className="space-y-3">
            <legend className="mb-1 flex items-center gap-2 font-bold">
              <Icon name="sparkle" size={16} /> Suggested for your goal
            </legend>
            {suggestion.courses.length === 0 && (
              <p className="text-sm text-ink-soft">None of the current courses fits this goal closely; you can still pick any below.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestion.courses.map((course) => (
                <CourseChoice
                  key={course.subject_slug}
                  slug={course.subject_slug}
                  name={nameOf(course.subject_slug)}
                  tag={course.role}
                  detail={course.reason}
                  checked={selected.includes(course.subject_slug)}
                  onToggle={() => toggle(course.subject_slug)}
                />
              ))}
            </div>
          </fieldset>
          {otherCourses.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="mb-1 font-bold">Other courses</legend>
              <p className="-mt-1 text-sm text-ink-soft">
                Tick any you&apos;d like in this plan. Courses you don&apos;t tick stay on their own if you already study them.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {otherCourses.map((subject) => (
                  <CourseChoice
                    key={subject.slug}
                    slug={subject.slug}
                    name={subject.name}
                    tag={subject.in_plan ? "In My courses" : undefined}
                    detail={subject.description}
                    checked={selected.includes(subject.slug)}
                    onToggle={() => toggle(subject.slug)}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <StepActions>
            <button type="button" className="btn btn-primary" disabled={selected.length === 0} onClick={() => setStep("time")}>
              Continue with {selected.length} course{selected.length === 1 ? "" : "s"} <Icon name="arrow" size={17} />
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("goal")}>
              Back
            </button>
          </StepActions>
        </section>
      )}

      {step === "time" && !busy && (
        <section className="panel space-y-6 p-6 sm:p-7">
          <StepTitle
            icon="clock"
            title="How much time do you have?"
            text="Set a deadline, or leave it empty and we'll show when you'd finish at this pace. You can change everything on the next screen."
          />
          <ScheduleControls settings={settings} onChange={setSettings} />
          <StepActions>
            <button type="button" className="btn btn-primary" onClick={() => requestDraft(selected, settings)}>
              <Icon name="sparkle" size={17} /> Build my plan
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStep("courses")}>
              Back
            </button>
          </StepActions>
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

/** The four steps as a connected tracker: done steps show a tick, the current one is highlighted. */
function Stepper({ step }: { step: Step }) {
  const current = STEPS.indexOf(step);
  return (
    <ol className="panel flex items-center gap-2 px-4 py-3 sm:px-5" aria-label="Planning steps">
      {STEPS.map((item, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={item} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors ${
                active ? "bg-brand shadow-[0_6px_16px_-8px_rgb(91_62_230/0.7)]" : done ? "bg-good text-on-accent" : "bg-paper text-ink-soft"
              }`}
            >
              {done ? <Icon name="check" size={16} /> : <Icon name={STEP_ICONS[item]} size={16} />}
            </span>
            <span className={`hidden text-sm font-bold whitespace-nowrap sm:inline ${active ? "text-ink" : "text-ink-soft"}`}>
              <span className="sr-only">Step {index + 1}: </span>
              {STEP_LABELS[item]}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden className={`h-0.5 min-w-4 flex-1 rounded-full ${done ? "bg-good" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepTitle({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="icon-tile h-11 w-11 bg-violet-tint text-violet">
        <Icon name={icon} size={21} />
      </span>
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-soft">{text}</p>
      </div>
    </div>
  );
}

function StepActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 border-t border-line pt-5">{children}</div>;
}

/** A message from the planner, shown as a chat bubble with the sparkle avatar. */
function PlannerSays({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="bg-brand grid h-10 w-10 shrink-0 place-items-center rounded-full">
        <Icon name="sparkle" size={18} />
      </span>
      <p className="rounded-2xl rounded-tl-sm border border-line bg-paper px-4 py-3">{text}</p>
    </div>
  );
}

function CourseChoice({
  slug,
  name,
  tag,
  detail,
  checked,
  onToggle,
}: {
  slug: string;
  name: string;
  tag?: string;
  detail: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet ${
        checked ? "border-violet bg-violet-tint/60" : "border-line bg-surface hover:-translate-y-0.5 hover:border-violet/40"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${checked ? "bg-brand" : "bg-violet-tint text-violet"}`}
      >
        <Icon name={slug.includes("javascript") ? "bolt" : "code"} size={19} />
      </span>
      <span className="min-w-0 flex-1 pr-6">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{name}</span>
          {tag && (
            <span className="rounded-full bg-blue-tint px-2 py-0.5 text-[11px] font-bold text-blue-deep">{tag}</span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-ink-soft">{detail}</span>
      </span>
      <span
        aria-hidden
        className={`absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-md border-2 ${
          checked ? "bg-brand border-transparent" : "border-line"
        }`}
      >
        {checked && <Icon name="check" size={11} />}
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
      <section className="panel relative space-y-5 overflow-hidden p-6 sm:p-7" aria-labelledby="draft-heading">
        <div aria-hidden className="glow -top-24 -right-16 h-60 w-60 bg-violet opacity-20" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sun/60 bg-sun-tint px-2.5 py-0.5 text-xs font-bold text-ink">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sun" /> Draft · not saved yet
          </span>
          <h2 id="draft-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
            {draft.goal}
          </h2>
        </div>
        <div className="relative">
          <PlannerSays text={draft.strategy.summary} />
        </div>

        <div className="relative grid gap-3 sm:grid-cols-3">
          <DraftStat icon="layers" label="Courses" value={String(draft.strategy.courses.length)} />
          <DraftStat icon="check" label="Tasks" value={String(draft.total_tasks)} />
          <DraftStat
            icon="flame"
            label={draft.fits ? "Finishing" : "Finishing (after deadline)"}
            value={draft.finish_date ? formatPlanDate(draft.finish_date) : "—"}
            warn={!draft.fits}
          />
        </div>

        <ol className="relative space-y-3">
          {draft.strategy.courses.map((course, index) => {
            const done = progressOf(course.subject_slug);
            return (
              <li key={course.subject_slug} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
                <span aria-hidden className="bg-brand grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {nameOf(course.subject_slug)}
                    {done > 0 && (
                      <span className="rounded-full bg-good-tint px-2 py-0.5 text-xs font-bold text-good">
                        {done}% done · only the rest is scheduled
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-soft">{course.reason}</p>
                  {course.depends_on.length > 0 && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-violet">
                      <Icon name="clock" size={13} />
                      Starts{" "}
                      {course.start_after_topics < 0
                        ? `after ${course.depends_on.map(nameOf).join(" and ")} is finished`
                        : `after ${course.start_after_topics} topic${course.start_after_topics === 1 ? "" : "s"} of ${course.depends_on
                            .map(nameOf)
                            .join(" and ")}`}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {draft.strategy.courses.length > 1 && (
          <p className="relative text-sm text-ink-soft">
            <span className="font-bold text-ink">
              {draft.strategy.day_sharing === "alternate" ? "Alternating days" : "Sharing each study day"}:
            </span>{" "}
            {draft.strategy.day_sharing_reason}
          </p>
        )}

        <div className="relative rounded-xl border border-line bg-paper/60 p-4">
          <h3 className="mb-3 font-bold">Timeline</h3>
          <PhaseTimeline phases={draft.phases} courseOrder={order} />
        </div>
        {draft.finish_date ? (
          !draft.fits && (
            <Alert>
              At this pace you&apos;d finish {formatPlanDate(draft.finish_date)}, after your deadline. Add study days or
              time, move the deadline, or ask for a lighter plan below.
            </Alert>
          )
        ) : (
          <Alert kind="info">There&apos;s nothing left to schedule for these courses.</Alert>
        )}
      </section>

      {draft.preview_days.length > 0 && (
        <section className="panel space-y-4 p-6 sm:p-7" aria-labelledby="preview-heading">
          <h3 id="preview-heading" className="flex items-center gap-2 text-lg font-bold">
            <Icon name="play" size={18} /> Your first sessions
          </h3>
          {draft.preview_days.map((day) => (
            <div key={day.date}>
              <p className="mb-2 text-xs font-bold tracking-wider text-ink-soft uppercase">{formatPlanDate(day.date)}</p>
              <ul className="space-y-2">
                {day.tasks.map((task) => (
                  <PlanTaskItem key={task.id} task={task} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel min-w-0 space-y-4 p-6" aria-labelledby="adjust-heading">
          <h3 id="adjust-heading" className="flex items-center gap-2 text-lg font-bold">
            <Icon name="sliders" size={18} /> Adjust the schedule
          </h3>
          <ScheduleControls settings={settings} onChange={setSettings} disabled={busy} />
          {scheduleChanged && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onScheduleChange(settings)}>
              Update the schedule
            </button>
          )}
        </section>

        <section className="panel flex min-w-0 flex-col gap-4 p-6" aria-labelledby="chat-heading">
          <div>
            <h3 id="chat-heading" className="flex items-center gap-2 text-lg font-bold">
              <Icon name="chat" size={18} /> Want changes? Just ask.
            </h3>
            <p className="text-sm text-ink-soft">The planner rebuilds the draft from what you say.</p>
          </div>
          {chat.length > 0 ? (
            <ul className="flex-1 space-y-3" aria-live="polite">
              {chat.map((entry, index) =>
                entry.from === "learner" ? (
                  <li key={index} className="flex justify-end">
                    <p className="bg-brand max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2 text-sm">{entry.text}</p>
                  </li>
                ) : (
                  <li key={index} className="flex items-start gap-2">
                    <span aria-hidden className="bg-brand grid h-7 w-7 shrink-0 place-items-center rounded-full">
                      <Icon name="sparkle" size={13} />
                    </span>
                    <p className="max-w-[85%] rounded-2xl rounded-tl-sm border border-line bg-paper px-4 py-2 text-sm">
                      {entry.text}
                    </p>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <div className="flex flex-1 flex-wrap content-start gap-2">
              {["No weekends", "Finish sooner", "Lighter days", "More practice"].map((idea) => (
                <button
                  key={idea}
                  type="button"
                  disabled={busy}
                  onClick={() => onMessageChange(idea)}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-violet/50 hover:text-ink"
                >
                  {idea}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2 rounded-2xl border border-line bg-paper p-1.5 focus-within:border-violet"
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
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              maxLength={500}
              value={message}
              disabled={busy}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder='e.g. "Finish JavaScript sooner"'
            />
            <button type="submit" className="btn btn-primary px-4 py-2 text-sm" disabled={busy || !message.trim()}>
              Send
            </button>
          </form>
        </section>
      </div>

      {/* Accept, kept in view while scrolling */}
      <div className="sticky bottom-4 z-10">
        <div className="panel flex flex-wrap items-center gap-3 p-4 shadow-[var(--shadow-lift)]">
          <p className="min-w-0 flex-1 basis-56 text-sm">
            <span className="font-bold">Happy with it?</span>{" "}
            <span className="text-ink-soft">Accept to save the plan. You can replan or edit it any time.</span>
          </p>
          {onCancel && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className="btn btn-primary px-6" disabled={busy} onClick={onAccept}>
            <Icon name="check" size={17} /> Accept plan
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftStat({ icon, label, value, warn }: { icon: IconName; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${warn ? "border-bad/30 bg-bad-tint" : "border-line bg-paper/60"}`}>
      <span aria-hidden className={`icon-tile h-9 w-9 ${warn ? "bg-surface text-bad" : "bg-violet-tint text-violet"}`}>
        <Icon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-soft">{label}</p>
        <p className={`truncate font-bold ${warn ? "text-bad" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
