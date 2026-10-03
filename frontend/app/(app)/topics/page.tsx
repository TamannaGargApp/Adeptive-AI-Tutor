"use client";

import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import TopicCard, { TopicDetail } from "@/components/TopicCard";
import { Alert, Spinner } from "@/components/ui";
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">{subjectName ? `${subjectName} topics` : "Topics"}</h1>
      <p className="mt-2 text-ink-soft">Open a topic to see what&apos;s left and choose how to study it.</p>

      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {!topics && !error && <Spinner />}
        {topics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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