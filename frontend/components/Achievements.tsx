import Link from "next/link";

import type { Badge, Gamification, Streak, XpLevel } from "@/lib/types";

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
const EARNED_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

/** Parse "2026-10-03" as a local date (new Date("2026-10-03") would be midnight UTC). */
export function parseDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function streakMessage(streak: Streak): string {
  if (streak.current === 0) return "Answer a question or ask the tutor something to start a streak.";
  if (!streak.active_today) return "Learn something today to keep your streak going!";
  return "You've learned today. Come back tomorrow to keep it going.";
}

export function StreakCalendar({ streak }: { streak: Streak }) {
  const lastIndex = streak.recent_days.length - 1;
  return (
    <div>
      <ol className="grid grid-cols-10 gap-1.5" aria-label="Learning activity over the last 30 days">
        {streak.recent_days.map((day, index) => {
          const label = `${parseDay(day.date).toLocaleDateString(undefined, DAY_FORMAT)}: ${day.active ? "active" : "no activity"}`;
          return (
            <li
              key={day.date}
              title={label}
              aria-label={label}
              className={`aspect-square rounded-md ${day.active ? "bg-good" : "bg-paper"} ${
                index === lastIndex ? "ring-2 ring-blue ring-offset-1 ring-offset-surface" : ""
              }`}
            />
          );
        })}
      </ol>
      <p className="mt-2 flex justify-between text-xs text-ink-soft">
        <span>30 days ago</span>
        <span>Today</span>
      </p>
    </div>
  );
}

export function LevelProgress({ level }: { level: XpLevel }) {
  const percent = Math.round((level.xp_into_level / level.xp_for_next_level) * 100);
  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold">Level {level.level}</span>
        <span className="text-sm text-ink-soft">{level.total_xp.toLocaleString()} XP total</span>
      </p>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-paper"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={level.xp_for_next_level}
        aria-valuenow={level.xp_into_level}
        aria-label={`Progress to level ${level.level + 1}`}
      >
        <div className="h-full rounded-full bg-sun" style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <p className="text-xs text-ink-soft">
        {level.xp_for_next_level - level.xp_into_level} XP to level {level.level + 1}
      </p>
    </div>
  );
}

export function BadgeCard({ badge }: { badge: Badge }) {
  const percent = Math.round((badge.progress / badge.target) * 100);
  return (
    <li
      className={`flex gap-3 rounded-xl border p-4 ${badge.earned ? "border-sun bg-sun-tint" : "border-line bg-surface"}`}
    >
      <span className={`text-3xl ${badge.earned ? "" : "opacity-40 grayscale"}`} aria-hidden>
        {badge.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {badge.name}
          <span className="sr-only">{badge.earned ? " (earned)" : " (locked)"}</span>
        </p>
        <p className="text-sm text-ink-soft">{badge.description}</p>
        {badge.earned && badge.earned_at ? (
          <p className="mt-1 text-xs font-bold text-ink-soft">
            Earned {new Date(badge.earned_at).toLocaleDateString(undefined, EARNED_FORMAT)}
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper" aria-hidden>
              <div className="h-full rounded-full bg-blue" style={{ width: `${percent}%` }} />
            </div>
            <span className="font-mono text-xs text-ink-soft">
              {badge.progress}/{badge.target}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  // Earned badges first (newest first), then locked ones closest to unlocking.
  const sorted = [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return (b.earned_at ?? "").localeCompare(a.earned_at ?? "");
    return b.progress / b.target - a.progress / a.target;
  });
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((badge) => (
        <BadgeCard key={badge.id} badge={badge} />
      ))}
    </ul>
  );
}

/** Compact streak, level and latest badges for the dashboard. */
export function GamificationSummary({ summary }: { summary: Gamification }) {
  const { streak, level, badges } = summary;
  const earned = badges
    .filter((badge) => badge.earned)
    .sort((a, b) => (b.earned_at ?? "").localeCompare(a.earned_at ?? ""));

  return (
    <section className="panel grid gap-5 p-5 sm:grid-cols-3" aria-label="Streak, level and badges">
      <div>
        <p className="text-sm font-bold text-ink-soft">Daily streak</p>
        <p className="mt-1 flex items-center gap-2 text-3xl font-bold">
          <span className={streak.active_today ? "" : "opacity-50 grayscale"} aria-hidden>
            🔥
          </span>
          {streak.current} day{streak.current === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{streakMessage(streak)}</p>
      </div>
      <div>
        <p className="mb-1 text-sm font-bold text-ink-soft">Experience</p>
        <LevelProgress level={level} />
      </div>
      <div>
        <p className="text-sm font-bold text-ink-soft">
          Badges · {earned.length} of {badges.length}
        </p>
        {earned.length > 0 ? (
          <ul className="mt-2 flex gap-2" aria-label="Latest badges">
            {earned.slice(0, 4).map((badge) => (
              <li key={badge.id} title={badge.name} className="text-3xl">
                <span aria-hidden>{badge.icon}</span>
                <span className="sr-only">{badge.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">Answer your first question to earn a badge.</p>
        )}
        <Link href="/achievements" className="mt-2 inline-block text-sm font-bold text-blue hover:text-blue-deep">
          View all achievements
        </Link>
      </div>
    </section>
  );
}