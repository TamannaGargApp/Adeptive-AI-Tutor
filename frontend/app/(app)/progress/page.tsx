"use client";

import { useEffect, useState } from "react";

import ProgressCard from "@/components/ProgressCard";
import RecommendationCard from "@/components/RecommendationCard";
import { Alert, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { OverallProgress, Recommendation } from "@/lib/types";

export default function ProgressPage() {
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
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Your progress</h1>
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

      {recommendation && <RecommendationCard recommendation={recommendation} />}

      {progress && (
        <p className="text-sm text-ink-soft">
          A topic is 100% complete when you&apos;ve answered at least 10 questions, got 9 of your last 10 right, and
          answered every key concept correctly at least once.
        </p>
      )}

      {progress && (
        <div className="grid gap-4 md:grid-cols-2">
          {progress.topics.map((topic) => (
            <ProgressCard key={topic.topic_slug} progress={topic} />
          ))}
        </div>
      )}
    </div>
  );
}