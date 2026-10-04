"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import ChatHistory from "@/components/ChatHistory";
import ChatWindow from "@/components/ChatWindow";
import PracticePanel from "@/components/PracticePanel";
import ReadingPanel from "@/components/ReadingPanel";
import Sidebar from "@/components/Sidebar";
import { Alert, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MODE_LABELS, studyLink } from "@/lib/labels";
import type { LearningMode, LearningSession, Level, StudyMode, Topic } from "@/lib/types";

function TutorWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [requestedDifficulty, setRequestedDifficulty] = useState<Level | null>(null);
  // Bumped whenever a new session request is needed for the same topic and mode.
  const [sessionVersion, setSessionVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { user } = useAuth();
  const sessionKeyRef = useRef("");
  // Learn mode continues the previous conversation unless the learner asks for a new one.
  const startFreshRef = useRef(false);

  // Only accept a topic from the current course; otherwise start at the course's first topic.
  const requestedTopic = searchParams.get("topic");
  const topicSlug =
    (requestedTopic && topics?.some((item) => item.slug === requestedTopic) ? requestedTopic : topics?.[0]?.slug) ?? "";
  const requestedMode = searchParams.get("mode");
  const mode: StudyMode = requestedMode === "practice" || requestedMode === "read" ? requestedMode : "learn";
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
    // Reload when the learner switches course from the navbar.
  }, [user?.current_subject]);

  useEffect(() => {
    // Read mode shows study notes and needs no learning session.
    if (!topicSlug || mode === "read") return;
    const key = `${topicSlug}|${mode}|${requestedDifficulty ?? "auto"}|${sessionVersion}`;
    // Skip duplicate runs (e.g. React's development double-render) for the same session request.
    if (sessionKeyRef.current === key) return;
    sessionKeyRef.current = key;

    const resume = mode === "learn" && !startFreshRef.current;
    startFreshRef.current = false;
    setError(null);
    api
      .createSession(topicSlug, mode as LearningMode, requestedDifficulty ?? undefined, resume)
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
    setSettingsOpen(false);
    router.replace(studyLink(slug, mode));
  }

  function changeMode(nextMode: StudyMode) {
    setSettingsOpen(false);
    if (nextMode === "quiz") router.push(studyLink(topicSlug, "quiz"));
    else router.replace(studyLink(topicSlug, nextMode));
  }

  function changeDifficulty(level: Level) {
    if (level === activeSession?.difficulty) return;
    setRequestedDifficulty(level);
    setSessionVersion((version) => version + 1);
  }

  function startNewConversation() {
    startFreshRef.current = true;
    setSession(null);
    setSessionVersion((version) => version + 1);
  }

  async function openConversation(sessionId: string) {
    setHistoryOpen(false);
    if (sessionId === activeSession?.id) return;
    setError(null);
    try {
      setSession(await api.getSession(sessionId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function applyAdaptiveDifficulty(level: Level) {
    setSession((current) => (current ? { ...current, difficulty: level } : current));
  }

  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  if (!topics) {
    return <div className="p-6">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <Sidebar
        topics={topics}
        topicSlug={topicSlug}
        mode={mode}
        difficulty={activeSession?.difficulty ?? requestedDifficulty}
        onTopicChange={changeTopic}
        onModeChange={changeMode}
        onDifficultyChange={changeDifficulty}
        mobileOpen={settingsOpen}
      />

      <section className="flex min-h-0 flex-1 flex-col" aria-label="Tutor">
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-3 sm:gap-3 sm:px-6">
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">
            {topic?.name ?? "Tutor"} <span className="font-normal text-ink-soft">· {MODE_LABELS[mode]}</span>
          </h1>
          {mode === "learn" && activeSession && (
            <>
              <button type="button" className="btn btn-secondary px-3 py-1.5 text-sm" onClick={() => setHistoryOpen(true)}>
                History
              </button>
              <button
                type="button"
                className="btn btn-secondary px-3 py-1.5 text-sm"
                onClick={startNewConversation}
                aria-label="New conversation"
              >
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">New conversation</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary px-3 py-1.5 text-sm lg:hidden"
            aria-expanded={settingsOpen}
            aria-controls="tutor-settings"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            {settingsOpen ? "Close" : "Settings"}
          </button>
        </div>

        {error && (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
            <Alert>{error}</Alert>
            <button type="button" className="btn btn-secondary" onClick={() => setSessionVersion((v) => v + 1)}>
              Try again
            </button>
          </div>
        )}
        {mode === "read" && topicSlug && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ReadingPanel key={topicSlug} topicSlug={topicSlug} />
          </div>
        )}
        {mode !== "read" && !activeSession && !error && (
          <div className="p-6">
            <Spinner label="Setting up your session…" />
          </div>
        )}

        {/* The chat manages its own scrolling so the message box stays pinned to the bottom. */}
        {!error && activeSession?.mode === "learn" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatWindow key={activeSession.id} session={activeSession} />
          </div>
        )}
        {!error && activeSession?.mode === "practice" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PracticePanel
              key={activeSession.id}
              session={activeSession}
              onDifficultyChange={applyAdaptiveDifficulty}
            />
          </div>
        )}
      </section>

      {historyOpen && topic && (
        <ChatHistory
          topicSlug={topic.slug}
          topicName={topic.name}
          currentSessionId={activeSession?.id ?? null}
          onSelect={openConversation}
          onClose={closeHistory}
        />
      )}
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