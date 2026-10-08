"use client";

import Link from "next/link";

import { courseExamLink } from "@/lib/labels";

import Countdown from "./Countdown";
import type { OverallProgress } from "@/lib/types";

const LOCK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/**
 * The course exam's state: locked until every topic is complete, then unlocked until passed.
 * Passing it completes the course.
 */
export default function CourseExamStatus({ progress, compact = false }: { progress: OverallProgress; compact?: boolean }) {
  const remark = progress.course_remarks[0];

  if (progress.course_completed) {
    return (
      <div className="rounded-xl border-l-4 border-good bg-good-tint px-4 py-3 text-sm" role="status">
        <p className="font-bold text-good">Course complete</p>
        <p className="text-ink">{remark}</p>
      </div>
    );
  }

  if (progress.course_exam_unlocked && progress.course_exam_locked_until) {
    return (
      <div className="rounded-xl border-l-4 border-bad bg-bad-tint px-4 py-3 text-sm" role="status">
        <p className="font-bold text-bad">Course exam: not passed yet</p>
        <p className="text-ink">
          {progress.course_exam_best !== null ? `Best score ${progress.course_exam_best}%. ` : ""}
          Retake available in <Countdown until={progress.course_exam_locked_until} />
        </p>
      </div>
    );
  }

  if (progress.course_exam_unlocked) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-4 border-sun bg-sun-tint px-4 py-3 text-sm">
        <p className="min-w-0 flex-1">
          <span className="block font-bold">Course exam unlocked</span>
          {!compact && <span className="text-ink">{remark}</span>}
        </p>
        <Link href={courseExamLink(progress.subject_slug)} className="btn btn-primary px-3 py-1.5 text-sm">
          Take the course exam
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-bold text-ink-soft">
        {LOCK_ICON}
        Course exam locked
      </p>
      <p className="mt-0.5 text-ink-soft">{remark}</p>
    </div>
  );
}