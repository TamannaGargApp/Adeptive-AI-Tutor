"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CourseExamStatus from "@/components/CourseExamStatus";
import { TodayPlanCard } from "@/components/StudyPlan";
import RecommendationCard from "@/components/RecommendationCard";
import { Icon } from "@/components/Icon";
import { Alert, CompletionBadge, CompletionBar, PageHeader, ProgressRing, Spinner, StatTile } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGamification } from "@/lib/gamification";
import { studyLink } from "@/lib/labels";
import type { OverallProgress, PlanTask, Recommendation, StudyPlan } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { summary: gamification } = useGamification();
  // undefined while loading, null when there's no plan for this course.
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null | undefined>(undefined);

  useEffect(() => {
    api
      .getStudyPlan()
      .then(setStudyPlan)
      .catch(() => setStudyPlan(null));
  }, [user?.current_subject]);

  function togglePlanTask(task: PlanTask) {
    api
      .setPlanTaskDone(task.id, !task.done)
      .then(setStudyPlan)
      .catch(() => undefined);
  }
  const [progress, setProgress] = useState<OverallProgress | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getProgress(), api.getRecommendation()])
      .then(([progressData, recommendationData]) => {
        setProgress(progressData);
        setRecommendation(recommendationData);
      })
      .catch((err) => setError(errorMessage(err)));
    // Reload when the learner switches course from the navbar.
  }, [user?.current_subject]);

  const firstName = user?.name.split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const earnedBadges = gamification?.badges.filter((badge) => badge.earned) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        icon="home"
        eyebrow={greeting}
        title={`Welcome back, ${firstName}`}
        description={
          progress
            ? `You're ${progress.completion_percent}% through ${progress.subject_name}, with ${progress.topics_completed} of ${progress.topics.length} topics complete.`
            : "Pick up where you left off."
        }
        actions={
          progress && (
            <ProgressRing percent={progress.completion_percent} size={84} stroke={8} label="Course completion">
              <span>
                <span className="block text-lg leading-none font-bold">{progress.completion_percent}%</span>
                <span className="text-[10px] font-bold tracking-wide text-ink-soft uppercase">course</span>
              </span>
            </ProgressRing>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          icon="flame"
          tone={4}
          label="Day streak"
          value={gamification ? `${gamification.streak.current} day${gamification.streak.current === 1 ? "" : "s"}` : "–"}
          hint={gamification ? (gamification.streak.active_today ? "You've studied today" : "Study today to keep it going") : undefined}
        />
        <StatTile
          icon="bolt"
          tone={1}
          label="Level"
          value={gamification ? `Level ${gamification.level.level}` : "–"}
          hint={gamification ? `${gamification.level.xp_for_next_level - gamification.level.xp_into_level} XP to level ${gamification.level.level + 1}` : undefined}
        >
          {gamification && (
            <CompletionBar
              percent={Math.round((gamification.level.xp_into_level / Math.max(1, gamification.level.xp_for_next_level)) * 100)}
              label="Progress to next level"
            />
          )}
        </StatTile>
        <StatTile
          icon="target"
          tone={2}
          label="Accuracy"
          value={progress ? `${progress.accuracy}%` : "–"}
          hint={progress ? `${progress.correct_answers} of ${progress.questions_attempted} right first time` : undefined}
        />
        <StatTile
          icon="layers"
          tone={5}
          label="Topics complete"
          value={progress ? `${progress.topics_completed} / ${progress.topics.length}` : "–"}
          hint={progress?.subject_name}
        />
      </div>

      {error && <Alert>{error}</Alert>}
      {!progress && !error && <Spinner />}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          {studyPlan ? (
            <TodayPlanCard plan={studyPlan} onToggle={togglePlanTask} compact />
          ) : (
            studyPlan === null && (
              <Link
                href="/study-plan"
                className="panel card-lift flex items-center gap-4 border-dashed border-violet/40 p-5"
              >
                <span aria-hidden className="icon-tile h-11 w-11 bg-sun-tint text-ink">
                  <Icon name="calendar" size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">Want a schedule?</span>
                  <span className="text-sm text-ink-soft">
                    Create a personalized study plan built from what you still need to do.
                  </span>
                </span>
                <Icon name="arrow" size={18} className="text-violet" />
              </Link>
            )
          )}

          {progress && (
            <section className="panel overflow-hidden" aria-labelledby="topics-heading">
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 id="topics-heading" className="text-lg font-bold">
                    {progress.subject_name} topics
                  </h2>
                  <p className="text-sm text-ink-soft">Pick up any topic where you left off.</p>
                </div>
                <Link href="/topics" className="text-sm font-bold text-violet hover:underline">
                  All topics
                </Link>
              </div>
              <ul className="divide-y divide-line">
                {progress.topics.map((topic, index) => (
                  <li key={topic.topic_slug}>
                    <Link
                      href={studyLink(topic.topic_slug, topic.questions_attempted > 0 ? "practice" : "learn")}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-5 py-3 transition-colors hover:bg-paper sm:grid-cols-[auto_13rem_1fr_9.5rem]"
                    >
                      <span
                        aria-hidden
                        className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                          topic.completed ? "bg-good-tint text-good" : topic.completion_percent > 0 ? "bg-violet-tint text-violet" : "bg-paper text-ink-soft"
                        }`}
                      >
                        {topic.completed ? <Icon name="check" size={14} /> : index + 1}
                      </span>
                      <span className="truncate font-bold">{topic.topic_name}</span>
                      <span className="col-span-3 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-auto">
                        <CompletionBar percent={topic.completion_percent} label={`${topic.topic_name} completion`} />
                        <span className="w-10 shrink-0 text-right text-sm font-bold">{topic.completion_percent}%</span>
                      </span>
                      <span className="justify-self-end">
                        <CompletionBadge status={topic.completion_status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {recommendation && <RecommendationCard recommendation={recommendation} />}

          {progress && <CourseExamStatus progress={progress} />}

          {gamification && (
            <section className="panel p-5" aria-labelledby="badges-heading">
              <div className="flex items-center justify-between gap-2">
                <h2 id="badges-heading" className="font-bold">
                  Badges
                </h2>
                <span className="text-sm text-ink-soft">
                  {earnedBadges.length} of {gamification.badges.length}
                </span>
              </div>
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {gamification.badges.slice(0, 10).map((badge) => (
                  <li
                    key={badge.id}
                    title={`${badge.name}: ${badge.description}`}
                    className={`grid aspect-square place-items-center rounded-xl text-xl ${
                      badge.earned ? "bg-sun-tint" : "bg-paper opacity-40 grayscale"
                    }`}
                  >
                    <span aria-hidden>{badge.icon}</span>
                    <span className="sr-only">
                      {badge.name}
                      {badge.earned ? " (earned)" : " (not earned yet)"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/achievements" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-violet hover:underline">
                View achievements <Icon name="arrow" size={14} />
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
