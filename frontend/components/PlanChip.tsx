"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { api, STUDY_PLAN_CHANGED_EVENT } from "@/lib/api";
import type { StudyPlan } from "@/lib/types";

/** Today's study plan progress in the header, e.g. "📅 2/3 today". Hidden without a plan. */
export default function PlanChip() {
  const pathname = usePathname();
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  const load = useCallback(() => {
    api
      .getStudyPlan()
      .then(setPlan)
      .catch(() => setPlan(null));
  }, []);

  // Refresh on every page change (activity elsewhere can tick tasks) and whenever the plan changes.
  useEffect(load, [load, pathname]);
  useEffect(() => {
    window.addEventListener(STUDY_PLAN_CHANGED_EVENT, load);
    return () => window.removeEventListener(STUDY_PLAN_CHANGED_EVENT, load);
  }, [load]);

  if (!plan) return null;
  const today = plan.days.find((day) => day.date === plan.today);
  const done = today?.tasks.filter((task) => task.done).length ?? 0;
  const total = today?.tasks.length ?? 0;
  const allDone = total > 0 && done === total;

  let label = "No study today";
  if (total > 0) label = allDone ? "Today done ✓" : `${done}/${total} today`;

  return (
    <Link
      href="/study-plan"
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-bold whitespace-nowrap ${
        allDone ? "border-good/50 text-good" : "border-line hover:border-blue/50"
      }`}
      title={plan.overdue_tasks > 0 ? `${plan.overdue_tasks} unfinished tasks from earlier days` : "Your study plan"}
      aria-label={`Study plan: ${label}. Open your study plan.`}
    >
      <span aria-hidden>📅</span>
      {label}
      {plan.overdue_tasks > 0 && <span className="h-2 w-2 rounded-full bg-bad" aria-hidden />}
    </Link>
  );
}