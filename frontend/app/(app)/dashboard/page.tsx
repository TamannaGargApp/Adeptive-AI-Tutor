"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import RecommendationCard from "@/components/RecommendationCard";
import { Alert, CompletionBadge, CompletionBar, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { studyLink } from "@/lib/labels";
import type { OverallProgress, Recommendation } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
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
      <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>

      {error && <Alert>{error}</Alert>}
      {!progress && !error && <Spinner />}

      {progress && (
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-8">
            <section aria-labelledby="overall-heading">
              <h2 id="overall-heading" className="mb-3 text-xl font-bold">
                Overall progress
              </h2>
              <div className="panel mb-3 space-y-2 p-4 sm:p-5">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="text-3xl font-bold">{progress.completion_percent}%</span>{" "}
                    <span className="text-ink-soft">of the Python course complete</span>
                  </span>
                  <span className="text-sm text-ink-soft">
                    {progress.topics_completed} of {progress.topics.length} topics complete
                  </span>
                </p>
                <CompletionBar percent={progress.completion_percent} label="Course completion" />
              </div>
              <dl className="panel grid grid-cols-3 divide-x divide-line">
                {[
                  { label: "Questions attempted", value: progress.questions_attempted },
                  { label: "Correct answers", value: progress.correct_answers },
                  { label: "Accuracy", value: `${progress.accuracy}%` },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 sm:p-5">
                    <dt className="text-sm text-ink-soft">{stat.label}</dt>
                    <dd className="mt-1 text-2xl font-bold sm:text-3xl">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              {progress.questions_attempted === 0 && (
                <p className="mt-3 text-sm text-ink-soft">
                  Your stats fill in as you answer practice and quiz questions.
                </p>
              )}
            </section>

            <section aria-labelledby="topics-heading">
              <h2 id="topics-heading" className="mb-3 text-xl font-bold">
                Topic progress
              </h2>
              <ul className="panel divide-y divide-line">
                {progress.topics.map((topic) => (
                  <li key={topic.topic_slug}>
                    <Link
                      href={studyLink(topic.topic_slug, topic.questions_attempted > 0 ? "practice" : "learn")}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-paper sm:grid-cols-[14rem_1fr_auto]"
                    >
                      <span className="font-bold">{topic.topic_name}</span>
                      <span className="col-span-2 row-start-2 flex items-center gap-3 sm:col-span-1 sm:row-start-auto">
                        <CompletionBar percent={topic.completion_percent} label={`${topic.topic_name} completion`} />
                        <span className="w-10 shrink-0 text-right text-sm font-bold">{topic.completion_percent}%</span>
                      </span>
                      <CompletionBadge status={topic.completion_status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div>{recommendation && <RecommendationCard recommendation={recommendation} />}</div>
        </div>
      )}
    </div>
  );
}