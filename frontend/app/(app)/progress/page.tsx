"use client";

import { useCallback, useEffect, useState } from "react";

import ActivityCharts from "@/components/ActivityCharts";
import CourseExamStatus from "@/components/CourseExamStatus";
import Modal from "@/components/Modal";
import ProgressCard from "@/components/ProgressCard";
import RecommendationCard from "@/components/RecommendationCard";
import TopicSummaryCard from "@/components/TopicSummaryCard";
import { Alert, Spinner } from "@/components/ui";
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
      <div>
        <h1 className="text-3xl font-bold">
          Your progress{progress ? <span className="text-ink-soft"> · {progress.subject_name}</span> : null}
        </h1>
        {progress && (
          <p className="mt-2 text-ink-soft">
            {progress.completion_percent}% of the course complete · {progress.topics_completed} of{" "}
            {progress.topics.length} topics complete · {progress.correct_answers} of {progress.questions_attempted} first
            attempts correct ({progress.accuracy}%).
          </p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {!progress && !error && <Spinner />}

      {progress && <CourseExamStatus progress={progress} />}

      <ActivityCharts />

      {recommendation && <RecommendationCard recommendation={recommendation} />}

      {progress && (
        <p className="text-sm text-ink-soft">
          A topic is 100% complete when you&apos;ve answered at least 10 questions, got 9 of your last 10 right,
          answered every key concept correctly, and passed its final test with 70% or more. The course is complete
          when every topic is complete and you pass the course exam.
        </p>
      )}

      {progress && (
        <section aria-labelledby="topics-heading" className="space-y-3">
          <h2 id="topics-heading" className="text-xl font-bold">
            Topics
          </h2>
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