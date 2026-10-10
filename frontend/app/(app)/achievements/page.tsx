"use client";

import { useState } from "react";

import ActivityCharts from "@/components/ActivityCharts";
import { BadgeGrid, levelTitle, LevelProgress, medalColors, sortBadges, StreakCalendar, streakMessage } from "@/components/Achievements";
import { Icon, type IconName } from "@/components/Icon";
import { ProgressRing, SectionHeading, Segmented, Spinner, TONES } from "@/components/ui";
import { useGamification } from "@/lib/gamification";

type BadgeFilter = "all" | "earned" | "locked";

const XP_RULES: { icon: IconName; label: string; xp: number }[] = [
  { icon: "target", label: "Right on the first try", xp: 10 },
  { icon: "check", label: "Any other answer", xp: 2 },
  { icon: "chat", label: "Message in Learn mode", xp: 3 },
  { icon: "quiz", label: "Topic test passed", xp: 50 },
  { icon: "trophy", label: "Course exam passed", xp: 200 },
];

export default function AchievementsPage() {
  const { summary } = useGamification();
  const [filter, setFilter] = useState<BadgeFilter>("all");

  if (!summary) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <Spinner />
      </div>
    );
  }

  const { streak, level, badges } = summary;
  const earned = badges.filter((badge) => badge.earned);
  const levelPercent = Math.round((level.xp_into_level / level.xp_for_next_level) * 100);
  // Locked badges with some progress, closest to unlocking first.
  const nextUp = sortBadges(badges)
    .filter((badge) => !badge.earned && badge.progress > 0)
    .slice(0, 3);
  const shown = badges.filter((badge) => (filter === "all" ? true : filter === "earned" ? badge.earned : !badge.earned));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8">
      {/* Hero: level medal, rank and XP, with the headline numbers */}
      {/* Open hero (no box), like the landing page. */}
      <header className="relative border-b border-line pt-2 pb-8 sm:pt-4">

        <div className="relative grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
          <ProgressRing percent={levelPercent} size={132} stroke={11} colors={["#8b5cf6", "#ec4899"]} label={`Progress to level ${level.level + 1}`}>
            <span className="flex flex-col items-center leading-none">
              <span className="text-xs font-bold tracking-wider text-ink-soft uppercase">Level</span>
              <span className="text-gradient mt-1 text-5xl font-bold">{level.level}</span>
            </span>
          </ProgressRing>

          <div className="min-w-0 max-w-xl space-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-violet uppercase">
                <Icon name="trophy" size={14} /> Achievements
              </p>
              <h1 className="text-3xl font-bold">{levelTitle(level.level)}</h1>
              <p className="text-ink-soft">
                {level.total_xp.toLocaleString()} XP earned so far. Keep learning to reach level {level.level + 1}.
              </p>
            </div>
            <LevelProgress level={level} />
          </div>

          <dl className="grid grid-cols-3 gap-3 lg:w-80 lg:grid-cols-1">
            <HeroStat icon="flame" tone={4} label="Day streak" value={`${streak.current}`} hint={streak.active_today ? "Active today" : "Not yet today"} />
            <HeroStat icon="bolt" tone={1} label="Longest streak" value={`${streak.longest}`} hint="days in a row" />
            <HeroStat icon="sparkle" tone={0} label="Badges" value={`${earned.length}/${badges.length}`} hint="collected" />
          </dl>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel space-y-4 p-5 sm:p-6" aria-labelledby="streak-heading">
          <div className="flex items-start gap-3">
            <span aria-hidden className={`icon-tile h-11 w-11 ${streak.active_today ? "tile-amber" : "bg-paper text-ink-soft"}`}>
              <Icon name="flame" size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="streak-heading" className="text-lg font-bold">
                {streak.current} day streak
              </h2>
              <p className="text-sm text-ink-soft">{streakMessage(streak)}</p>
            </div>
            <p className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold whitespace-nowrap text-ink-soft">
              Best: {streak.longest}
            </p>
          </div>
          <StreakCalendar streak={streak} />
        </section>

        <section className="panel p-5 sm:p-6" aria-labelledby="xp-heading">
          <h2 id="xp-heading" className="text-lg font-bold">
            How to earn XP
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {XP_RULES.map((rule, index) => (
              <li key={rule.label} className="flex items-center gap-3 py-2.5">
                <span aria-hidden className={`icon-tile h-8 w-8 rounded-lg ${TONES[index % TONES.length]}`}>
                  <Icon name={rule.icon} size={15} />
                </span>
                <span className="flex-1 text-sm">{rule.label}</span>
                <span className="xp-pill rounded-full px-2.5 py-0.5 text-xs font-bold">+{rule.xp} XP</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {nextUp.length > 0 && (
        <section aria-labelledby="next-heading">
          <SectionHeading id="next-heading" title="Almost there" description="The badges you're closest to unlocking." />
          <ul className="grid gap-3 md:grid-cols-3">
            {nextUp.map((badge) => (
              <li key={badge.id} className="panel card-lift flex items-center gap-4 p-4">
                <ProgressRing
                  percent={(badge.progress / badge.target) * 100}
                  size={60}
                  stroke={6}
                  colors={medalColors(badge.id)}
                  label={`${badge.name} progress`}
                >
                  <span aria-hidden className="text-2xl">
                    {badge.icon}
                  </span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="font-bold">{badge.name}</p>
                  <p className="text-sm text-ink-soft">{badge.description}</p>
                  <p className="mt-0.5 text-xs font-bold" style={{ color: medalColors(badge.id)[0] }}>
                    {badge.target - badge.progress} more to go
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="badges-heading">
        <SectionHeading
          id="badges-heading"
          title="Badge collection"
          description={`${earned.length} of ${badges.length} collected`}
          action={
            <div className="w-full sm:w-72">
              <Segmented<BadgeFilter>
                label="Show badges"
                value={filter}
                onChange={setFilter}
                size="sm"
                options={[
                  { value: "all", label: `All (${badges.length})` },
                  { value: "earned", label: `Earned (${earned.length})` },
                  { value: "locked", label: `Locked (${badges.length - earned.length})` },
                ]}
              />
            </div>
          }
        />
        {shown.length > 0 ? (
          <BadgeGrid badges={shown} />
        ) : (
          <p className="panel p-6 text-center text-ink-soft">
            {filter === "earned" ? "Answer your first question to earn a badge." : "You've collected every badge. Amazing!"}
          </p>
        )}
      </section>

      <ActivityCharts />
    </div>
  );
}

function HeroStat({ icon, tone, label, value, hint }: { icon: IconName; tone: number; label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface/80 p-3 text-center lg:flex-row lg:gap-3 lg:text-left">
      <span aria-hidden className={`icon-tile h-10 w-10 shrink-0 ${TONES[tone % TONES.length]}`}>
        <Icon name={icon} size={19} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-soft">{label}</dt>
        <dd className="text-xl leading-tight font-bold">{value}</dd>
        <dd className="hidden text-xs text-ink-soft sm:block">{hint}</dd>
      </div>
    </div>
  );
}
