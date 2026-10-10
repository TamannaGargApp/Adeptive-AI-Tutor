"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import PlanWizard, { type WizardMode } from "@/components/PlanWizard";
import { formatPlanDate, PhaseTimeline, PlanTaskItem, TodayPlanCard } from "@/components/StudyPlan";
import { Alert, CompletionBar, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WEEKDAY_LABELS } from "@/lib/labels";
import type { PlanTask, StudyPlan } from "@/lib/types";

/** ?edit=1, ?add=<course> or ?remove=<course> open the planner on a draft of the changed plan. */
function wizardModeFrom(params: URLSearchParams): WizardMode | null {
  if (params.get("add")) return { kind: "add", slug: params.get("add") as string };
  if (params.get("remove")) return { kind: "remove", slug: params.get("remove") as string };
  if (params.get("edit")) return { kind: "edit" };
  return null;
}

function StudyPlanPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined);
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = wizardModeFrom(searchParams);

  useEffect(() => {
    api
      .getStudyPlan()
      .then(setPlan)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function run(action: () => Promise<StudyPlan | null>) {
    setBusy(true);
    setError(null);
    try {
      setPlan(await action());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function accepted(saved: StudyPlan) {
    setPlan(saved);
    // Accepting adds the plan's courses to My courses.
    setUser(await api.me());
    router.replace("/study-plan");
  }

  function toggle(task: PlanTask) {
    void run(() => api.setPlanTaskDone(task.id, !task.done));
  }

  if (plan === undefined) {
    return <div className="p-6">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;
  }

  if (plan === null || mode) {
    const wizardMode = plan === null ? ({ kind: "new" } as WizardMode) : (mode as WizardMode);
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <PageHeader
          icon="calendar"
          eyebrow="Study plan"
          title={plan === null ? "Create your study plan" : wizardMode.kind === "edit" ? "Edit your study plan" : "Update your study plan"}
          description={
            plan === null
              ? "Tell us your goal. We'll suggest courses, work out the timing, and build a plan you can adjust before saving."
              : "Here's a draft of your changed plan. Your current plan stays as it is until you accept."
          }
        />
        <PlanWizard
          plan={plan}
          mode={wizardMode}
          onAccepted={accepted}
          onCancel={plan ? () => router.replace("/study-plan") : undefined}
        />
      </div>
    );
  }

  const upcoming = plan.days.filter((day) => day.date > plan.today);
  const past = plan.days.filter((day) => day.date < plan.today);
  const percent = plan.total_tasks ? Math.round((plan.done_tasks / plan.total_tasks) * 100) : 100;
  const order = plan.strategy.courses.map((course) => course.subject_slug);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        icon="calendar"
        eyebrow="Your study plan"
        title={plan.goal}
        description={`${plan.settings.study_days.map((day) => WEEKDAY_LABELS[day]).join(", ")} · ${plan.settings.minutes_per_day} min per day${
          plan.settings.target_date ? ` · deadline ${formatPlanDate(plan.settings.target_date)}` : ""
        }`}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(api.replanStudyPlan)}>
            Replan from today
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.push("/study-plan?edit=1")}>
            Edit plan
          </button>
          <button
            type="button"
            className="btn btn-secondary text-bad"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Delete your study plan? Its courses stay in My courses with all your progress.")) {
                void run(async () => {
                  await api.deleteStudyPlan();
                  return null;
                });
              }
            }}
          >
            Delete plan
          </button>
        </div>
      </PageHeader>

      {error && <Alert>{error}</Alert>}

      {/* Two columns on large screens: today and what's next on the left, the plan overview on the right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="min-w-0 space-y-6">
        <TodayPlanCard plan={plan} onToggle={toggle} />

        <section aria-labelledby="schedule-heading" className="space-y-4">
          <h2 id="schedule-heading" className="text-xl font-bold">
            Upcoming
          </h2>
          {past.length > 0 && (
            <button
              type="button"
              className="text-sm font-bold text-blue hover:text-blue-deep"
              aria-expanded={showPast}
              onClick={() => setShowPast((current) => !current)}
            >
              {showPast ? "Hide" : "Show"} earlier days ({past.length})
            </button>
          )}
          {[...(showPast ? past : []), ...upcoming].map((day) => (
            <div key={day.date} data-reveal>
              <h3 className={`mb-2 text-sm font-bold ${day.date < plan.today ? "text-ink-soft" : ""}`}>{formatPlanDate(day.date)}</h3>
              <ul className="space-y-2">
                {day.tasks.map((task) => (
                  <PlanTaskItem key={task.id} task={task} onToggle={toggle} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24">
      <section className="panel space-y-3 p-5" aria-label="Plan summary">
        <p className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            <span className="text-2xl font-bold">{plan.goal_progress}%</span>{" "}
            <span className="text-ink-soft">toward your goal</span>
            <span className="ml-3 text-sm text-ink-soft">
              · {plan.done_tasks} of {plan.total_tasks} plan tasks done ({percent}%)
            </span>
          </span>
          {plan.estimated_finish && (
            <span className={`text-sm font-bold ${plan.fits ? "text-good" : "text-bad"}`}>
              {plan.fits ? "On track" : "Behind your deadline"}: last session {formatPlanDate(plan.estimated_finish)}
            </span>
          )}
        </p>
        <CompletionBar percent={plan.goal_progress} label="Progress toward your goal" />
        <p className="text-xs text-ink-soft">
          Goal progress counts everything you&apos;ve completed in these courses, including work done before this plan.
          Tasks tick themselves as you read, ask the tutor, practise and pass tests.
        </p>
        <p className="text-sm text-ink-soft">{plan.strategy.summary}</p>
      </section>

      <section className="panel space-y-3 p-5" aria-labelledby="plan-courses-heading">
        <h2 id="plan-courses-heading" className="text-lg font-bold">
          Courses in this plan
        </h2>
        <ul className="space-y-2">
          {plan.course_details.map((course) => (
            <li key={course.subject_slug} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  {course.subject_name}
                  <span className="ml-2 text-sm font-normal text-ink-soft">
                    {course.completion_percent}% complete · {course.topics_completed} of {course.topics_total} topics done
                  </span>
                </span>
                <span className="text-sm text-ink-soft">{course.reason}</span>
              </span>
              {plan.course_details.length > 1 && (
                <button
                  type="button"
                  className="text-sm font-bold text-blue hover:text-blue-deep"
                  onClick={() => router.push(`/study-plan?remove=${course.subject_slug}`)}
                >
                  Take out of plan
                </button>
              )}
            </li>
          ))}
        </ul>
        <div>
          <h3 className="mb-2 text-sm font-bold text-ink-soft">Timeline</h3>
          <PhaseTimeline phases={plan.phases} courseOrder={order} />
        </div>
      </section>
      </aside>
      </div>
    </div>
  );
}

export default function StudyPlanPage() {
  return (
    <Suspense>
      <StudyPlanPageContent />
    </Suspense>
  );
}