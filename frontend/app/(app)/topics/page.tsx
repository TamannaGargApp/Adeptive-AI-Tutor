"use client";

import { useEffect, useState } from "react";

import TopicCard from "@/components/TopicCard";
import { Alert, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Topic, TopicProgress } from "@/lib/types";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [progressBySlug, setProgressBySlug] = useState<Record<string, TopicProgress>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getTopics(), api.getProgress()])
      .then(([topicList, progress]) => {
        setTopics(topicList);
        setProgressBySlug(Object.fromEntries(progress.topics.map((item) => [item.topic_slug, item])));
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Python topics</h1>
      <p className="mt-2 text-ink-soft">Pick a topic, then choose how you want to study it.</p>

      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {!topics && !error && <Spinner />}
        {topics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <TopicCard key={topic.slug} topic={topic} progress={progressBySlug[topic.slug]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
