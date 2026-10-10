"use client";

import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import TopicCard, { TopicDetail } from "@/components/TopicCard";
import { Alert, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Topic, TopicProgress } from "@/lib/types";

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [progressBySlug, setProgressBySlug] = useState<Record<string, TopicProgress>>({});
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const closeTopic = useCallback(() => setOpenTopic(null), []);
  const selected = topics?.find((topic) => topic.slug === openTopic);
  const [subjectName, setSubjectName] = useState("");

  useEffect(() => {
    Promise.all([api.getTopics(), api.getProgress()])
      .then(([topicList, progress]) => {
        setTopics(topicList);
        setSubjectName(progress.subject_name);
        setProgressBySlug(Object.fromEntries(progress.topics.map((item) => [item.topic_slug, item])));
      })
      .catch((err) => setError(errorMessage(err)));
    // Reload when the learner switches course from the navbar.
  }, [user?.current_subject]);

  const statusCount = (test: (progress: TopicProgress) => boolean) =>
    Object.values(progressBySlug).filter(test).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        icon="layers"
        eyebrow={subjectName ? `${subjectName} course` : undefined}
        title="Topics"
        description="Open a topic to see what's left and choose how to study it."
      >
        {topics && (
          <ul className="flex flex-wrap gap-2 text-sm">
            {[
              { label: "Complete", count: statusCount((p) => p.completed), dot: "bg-good" },
              { label: "In progress", count: statusCount((p) => !p.completed && p.completion_percent > 0), dot: "bg-violet" },
              { label: "Not started", count: topics.length - statusCount((p) => p.completion_percent > 0), dot: "bg-ink-soft/50" },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1">
                <span aria-hidden className={`h-2 w-2 rounded-full ${item.dot}`} />
                <span className="font-bold">{item.count}</span>
                <span className="text-ink-soft">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </PageHeader>

      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {!topics && !error && <Spinner />}
        {topics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {topics.map((topic) => (
              <TopicCard
                key={topic.slug}
                topic={topic}
                progress={progressBySlug[topic.slug]}
                onOpen={() => setOpenTopic(topic.slug)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <Modal title={selected.name} onClose={closeTopic}>
          <TopicDetail topic={selected} progress={progressBySlug[selected.slug]} />
        </Modal>
      )}
    </div>
  );
}