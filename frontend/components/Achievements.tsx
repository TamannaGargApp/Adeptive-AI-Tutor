import Link from "next/link";

import type { Badge, Gamification, Streak, XpLevel } from "@/lib/types";

import { Icon } from "./Icon";

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

/** A friendly title for each stage, shown next to the level number. */
const LEVEL_TITLES: [number, string][] = [
  [20, "Master"],
  [15, "Expert"],
  [11, "Builder"],
  [8, "Coder"],
  [5, "Problem solver"],
  [3, "Explorer"],
  [1, "Beginner"],
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES.find(([from]) => level >= from)?.[1] ?? "Beginner";
}

export function StreakCalendar({ streak }: { streak: Streak }) {
  const lastIndex = streak.recent_days.length - 1;
  return (
    <div>
      <ol className="grid grid-cols-10 gap-1.5 sm:grid-cols-15" aria-label="Learning activity over the last 30 days">
        {streak.recent_days.map((day, index) => {
          const label = `${parseDay(day.date).toLocaleDateString(undefined, DAY_FORMAT)}: ${day.active ? "active" : "no activity"}`;
          return (
            <li
              key={day.date}
              title={label}
              aria-label={label}
              className={`aspect-square rounded-md ${day.active ? "streak-on" : "bg-line/60"} ${
                index === lastIndex ? "ring-2 ring-[#f97316] ring-offset-2 ring-offset-surface" : ""
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
      <div
        className="h-2.5 overflow-hidden rounded-full bg-line/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={level.xp_for_next_level}
        aria-valuenow={level.xp_into_level}
        aria-label={`Progress to level ${level.level + 1}`}
      >
        <div className="level-fill h-full rounded-full" style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <p className="flex justify-between gap-2 text-xs text-ink-soft">
        <span>
          {level.xp_into_level} / {level.xp_for_next_level} XP
        </span>
        <span>{level.xp_for_next_level - level.xp_into_level} XP to level {level.level + 1}</span>
      </p>
    </div>
  );
}

/** A badge as a medal: earned ones glow in the logo gradient, locked ones show how close they are. */
/** Colour pairs for medals and rings, so every badge has its own colour. */
export const MEDAL_COLORS: [string, string][] = [
  ["#f97316", "#ec4899"],
  ["#0ea5e9", "#6366f1"],
  ["#10b981", "#14b8a6"],
  ["#8b5cf6", "#d946ef"],
  ["#f59e0b", "#f97316"],
  ["#ec4899", "#f43f5e"],
  ["#22d3ee", "#10b981"],
];

/** A badge's colour, always the same for the same badge. */
export function medalColors(id: string): [string, string] {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return MEDAL_COLORS[hash % MEDAL_COLORS.length];
}

export function BadgeCard({ badge }: { badge: Badge }) {
  const percent = Math.round((badge.progress / badge.target) * 100);
  const [from, to] = medalColors(badge.id);
  return (
    <li
      className={`panel card-lift relative flex flex-col items-center overflow-hidden p-5 text-center ${
        badge.earned ? "" : "bg-paper/60 shadow-none"
      }`}
    >
      {/* A soft glow of the badge's colour behind earned medals. */}
      {badge.earned && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full opacity-25"
          style={{ background: `radial-gradient(closest-side, ${from}, transparent)` }}
        />
      )}
      <span className="relative">
        <span
          aria-hidden
          className={`grid h-16 w-16 place-items-center rounded-full text-3xl ${
            badge.earned ? "" : "border-2 border-dashed border-line bg-surface opacity-70 grayscale"
          }`}
          style={
            badge.earned
              ? { background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 10px 24px -10px ${from}` }
              : undefined
          }
        >
          <span className={badge.earned ? "grid h-[52px] w-[52px] place-items-center rounded-full bg-surface" : ""}>
            {badge.icon}
          </span>
        </span>
        {!badge.earned && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-ink-soft"
          >
            <Icon name="lock" size={12} />
          </span>
        )}
      </span>
      <p className="mt-3 font-bold">
        {badge.name}
        <span className="sr-only">{badge.earned ? " (earned)" : " (locked)"}</span>
      </p>
      <p className="mt-0.5 text-sm text-ink-soft">{badge.description}</p>
      {badge.earned && badge.earned_at ? (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-good-tint px-2.5 py-0.5 text-xs font-bold text-good">
          <Icon name="check" size={12} /> {new Date(badge.earned_at).toLocaleDateString(undefined, EARNED_FORMAT)}
        </p>
      ) : (
        <div className="mt-3 flex w-full items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(percent, percent > 0 ? 4 : 0)}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
            />
          </div>
          <span className="text-xs font-bold text-ink-soft">
            {badge.progress}/{badge.target}
          </span>
        </div>
      )}
    </li>
  );
}

/** Earned badges first (newest first), then locked ones closest to unlocking. */
export function sortBadges(badges: Badge[]): Badge[] {
  return [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return (b.earned_at ?? "").localeCompare(a.earned_at ?? "");
    return b.progress / b.target - a.progress / a.target;
  });
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {sortBadges(badges).map((badge) => (
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