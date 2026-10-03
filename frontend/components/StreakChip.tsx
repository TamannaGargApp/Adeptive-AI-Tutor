"use client";

import Link from "next/link";

import { useGamification } from "@/lib/gamification";

/** Current streak and level, linking to the achievements page. */
export default function StreakChip() {
  const { summary } = useGamification();
  if (!summary) return null;
  const { streak, level } = summary;

  return (
    <Link
      href="/achievements"
      className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1 text-sm font-bold hover:border-sun"
      title={streak.active_today ? "You've learned today" : "Learn today to keep your streak"}
      aria-label={`${streak.current} day streak, level ${level.level}. View achievements.`}
    >
      <span className={streak.active_today ? "" : "opacity-50 grayscale"} aria-hidden>
        🔥
      </span>
      <span>{streak.current}</span>
      <span className="text-ink-soft" aria-hidden>
        ·
      </span>
      <span className="text-ink-soft">Lv {level.level}</span>
    </Link>
  );
}