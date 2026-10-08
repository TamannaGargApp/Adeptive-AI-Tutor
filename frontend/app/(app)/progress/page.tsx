"use client";

import { useCallback, useEffect, useState } from "react";

import ActivityCharts from "@/components/ActivityCharts";
import FeedbackPanel from "@/components/FeedbackPanel";
import CourseExamStatus from "@/components/CourseExamStatus";
import Modal from "@/components/Modal";
import ProgressCard from "@/components/ProgressCard";
import RecommendationCard from "@/components/RecommendationCard";
import TopicSummaryCard from "@/components/TopicSummaryCard";
import { Alert, PageHeader, ProgressRing, SectionHeading, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { OverallProgress, Recommendation } from "@/lib/types";

export default function ProgressPage() {
  const [progress, setProgress] = useState<OverallProgress | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const closeTopic = useCallback(() => setOpenTopic(null), []);
  const selected = progress?.topics.find((topic) => topic.topic_slug === openTopic);

  useEffect(() => {
    Promise.all([api.getProgress(), api.getRecommendation()])
      .then(([progressData, recommendationData]) => {
        setProgress(progressData);
        setRecommendation(recommendationData);
      })
      .catch((err) => setError(errorMessage(err)));
    // Reload when the learner switches course from the navbar.
  }, [user?.current_subject]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        icon="chart"
        eyebrow={progress ? `${progress.subject_name} course` : undefined}
        title="Your progress"
        description="How far you've come, what's going well, and what to work on next."
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
      >
        {progress && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Topics complete", value: `${progress.topics_completed} / ${progress.topics.length}` },
              { label: "Questions answered", value: progress.questions_attempted },
              { label: "Right first time", value: progress.correct_answers },
              { label: "Accuracy", value: `${progress.accuracy}%` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-line bg-surface/80 px-4 py-3">
                <dt className="text-xs text-ink-soft">{stat.label}</dt>
                <dd className="text-xl font-bold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </PageHeader>

      {error && <Alert>{error}</Alert>}
      {!progress && !error && <Spinner />}

      {progress && (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0">
            <ActivityCharts />
          </div>
          <div className="space-y-6">
            {recommendation && <RecommendationCard recommendation={recommendation} />}
            <CourseExamStatus progress={progress} />
          </div>
        </div>
      )}

      {progress && <FeedbackPanel subjectSlug={progress.subject_slug} />}

      {progress && (
        <section aria-labelledby="topics-heading">
          <SectionHeading
            id="topics-heading"
            title="Topics"
            description="A topic is complete when you've answered at least 10 questions, got 9 of your last 10 right, answered every key concept correctly, and passed its final test with 70% or more."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {progress.topics.map((topic) => (
              <TopicSummaryCard key={topic.topic_slug} progress={topic} onOpen={() => setOpenTopic(topic.topic_slug)} />
            ))}
          </div>
        </section>
      )}

      {selected && (
        <Modal title={selected.topic_name} onClose={closeTopic}>
          <ProgressCard progress={selected} embedded />
        </Modal>
      )}
    </div>
  );
}