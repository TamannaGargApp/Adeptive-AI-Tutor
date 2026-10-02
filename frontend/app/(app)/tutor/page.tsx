"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import ChatWindow from "@/components/ChatWindow";
import PracticePanel from "@/components/PracticePanel";
import Sidebar from "@/components/Sidebar";
import { Alert, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { MODE_LABELS, studyLink } from "@/lib/labels";
import type { LearningMode, LearningSession, Level, Topic } from "@/lib/types";

function TutorWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [requestedDifficulty, setRequestedDifficulty] = useState<Level | null>(null);
  // Bumped whenever a brand-new session is wanted for the same topic and mode.
  const [sessionVersion, setSessionVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sessionKeyRef = useRef("");

  const topicSlug = searchParams.get("topic") ?? topics?.[0]?.slug ?? "";
  const mode: LearningMode = searchParams.get("mode") === "practice" ? "practice" : "learn";
  const topic = topics?.find((item) => item.slug === topicSlug);
  // Right after switching topic or mode, `session` still holds the previous one until the new
  // session arrives. Only use it when it matches what's on screen, or a practice panel could
  // request questions from a Learn session.
  const activeSession =
    session && session.topic_slug === topicSlug && session.mode === mode ? session : null;

  useEffect(() => {
    api
      .getTopics()
      .then(setTopics)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!topicSlug) return;
    const key = `${topicSlug}|${mode}|${requestedDifficulty ?? "auto"}|${sessionVersion}`;
    // Skip duplicate runs (e.g. React's development double-render) for the same session request.
    if (sessionKeyRef.current === key) return;
    sessionKeyRef.current = key;

    setSession(null);
    setError(null);
    api
      .createSession(topicSlug, mode, requestedDifficulty ?? undefined)
      .then((created) => {
        // Ignore responses for a topic or mode the learner has already switched away from.
        if (sessionKeyRef.current === key) setSession(created);
      })
      .catch((err) => {
        if (sessionKeyRef.current === key) setError(errorMessage(err));
      });
  }, [topicSlug, mode, requestedDifficulty, sessionVersion]);

  function changeTopic(slug: string) {
    setRequestedDifficulty(null);
    router.replace(studyLink(slug, mode));
  }

  function changeMode(nextMode: LearningMode) {
    if (nextMode === "quiz") router.push(studyLink(topicSlug, "quiz"));
    else router.replace(studyLink(topicSlug, nextMode));
  }

  function changeDifficulty(level: Level) {
    if (level === activeSession?.difficulty) return;
    setRequestedDifficulty(level);
    setSessionVersion((version) => version + 1);
  }

  function applyAdaptiveDifficulty(level: Level) {
    setSession((current) => (current ? { ...current, difficulty: level } : current));
  }

  if (!topics) {
    return <div className="p-6">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;
  }

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-3.75rem)] lg:flex-row">
      <Sidebar
        topics={topics}
        topicSlug={topicSlug}
        mode={mode}
        difficulty={activeSession?.difficulty ?? requestedDifficulty}
        onTopicChange={changeTopic}
        onModeChange={changeMode}
        onDifficultyChange={changeDifficulty}
      />

      <section className="flex h-[78dvh] min-h-0 flex-1 flex-col lg:h-auto" aria-label="Tutor">
        <div className="border-b border-line bg-surface px-4 py-3 sm:px-6">
          <h1 className="text-lg font-bold">
            {topic?.name ?? "Tutor"} <span className="font-normal text-ink-soft">· {MODE_LABELS[mode]}</span>
          </h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <div className="space-y-3 p-6">
              <Alert>{error}</Alert>
              <button type="button" className="btn btn-secondary" onClick={() => setSessionVersion((v) => v + 1)}>
                Try again
              </button>
            </div>
          )}
          {!activeSession && !error && (
            <div className="p-6">
              <Spinner label="Setting up your session…" />
            </div>
          )}
          {activeSession?.mode === "learn" && <ChatWindow key={activeSession.id} session={activeSession} />}
          {activeSession?.mode === "practice" && (
            <PracticePanel
              key={activeSession.id}
              session={activeSession}
              onDifficultyChange={applyAdaptiveDifficulty}
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense>
      <TutorWorkspace />
    </Suspense>
  );
}
