"use client";

import ActivityCharts from "@/components/ActivityCharts";
import { BadgeGrid, LevelProgress, StreakCalendar, streakMessage } from "@/components/Achievements";
import { PageHeader, Spinner } from "@/components/ui";
import { useGamification } from "@/lib/gamification";

export default function AchievementsPage() {
  const { summary } = useGamification();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        icon="trophy"
        title="Achievements"
        description="Keep your streak alive, level up with XP, and collect badges as you learn."
      />

      {!summary && <Spinner />}

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="panel space-y-4 p-5" aria-labelledby="streak-heading">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="streak-heading" className="text-sm font-bold text-ink-soft">
                    Daily streak
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-4xl font-bold">
                    <span className={summary.streak.active_today ? "" : "opacity-50 grayscale"} aria-hidden>
                      🔥
                    </span>
                    {summary.streak.current} day{summary.streak.current === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-right text-sm text-ink-soft">
                  Longest
                  <span className="block text-xl font-bold text-ink">{summary.streak.longest}</span>
                </p>
              </div>
              <p className="text-sm text-ink-soft">{streakMessage(summary.streak)}</p>
              <StreakCalendar streak={summary.streak} />
            </section>

            <section className="panel space-y-4 p-5" aria-labelledby="xp-heading">
              <h2 id="xp-heading" className="text-sm font-bold text-ink-soft">
                Experience
              </h2>
              <LevelProgress level={summary.level} />
              <div>
                <h3 className="text-sm font-bold">How to earn XP</h3>
                <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink-soft">
                  <li>Right on the first try: +10</li>
                  <li>Any other answer: +2</li>
                  <li>Learn mode message: +3</li>
                  <li>Topic test passed: +50</li>
                  <li>Course exam passed: +200</li>
                </ul>
              </div>
            </section>
          </div>

          <section aria-labelledby="badges-heading" className="space-y-3">
            <h2 id="badges-heading" className="text-xl font-bold">
              Badges · {summary.badges.filter((badge) => badge.earned).length} of {summary.badges.length}
            </h2>
            <BadgeGrid badges={summary.badges} />
          </section>

          <ActivityCharts />
        </>
      )}
    </div>
  );
}