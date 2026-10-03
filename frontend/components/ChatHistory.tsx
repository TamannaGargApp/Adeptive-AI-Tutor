"use client";

import { useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { LEVEL_LABELS } from "@/lib/labels";
import type { SessionSummary } from "@/lib/types";

import { Alert, Spinner } from "./ui";

interface ChatHistoryProps {
  topicSlug: string;
  topicName: string;
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

/** Slide-over panel listing the learner's past Learn conversations for one topic. */
export default function ChatHistory({ topicSlug, topicName, currentSessionId, onSelect, onClose }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api
      .listLearnSessions(topicSlug)
      .then(setSessions)
      .catch((err) => setError(errorMessage(err)));
  }, [topicSlug]);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="history-heading">
      <button type="button" aria-label="Close history" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-sm flex-col border-l border-line bg-surface shadow-xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="history-heading" className="font-bold">
              Conversation history
            </h2>
            <p className="truncate text-sm text-ink-soft">{topicName}</p>
          </div>
          <button ref={closeRef} type="button" className="btn btn-secondary px-3 py-1.5 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error && <Alert>{error}</Alert>}
          {!sessions && !error && (
            <div className="p-2">
              <Spinner />
            </div>
          )}
          {sessions?.length === 0 && (
            <p className="p-2 text-sm text-ink-soft">No past conversations for this topic yet.</p>
          )}
          {sessions && sessions.length > 0 && (
            <ul className="space-y-2">
              {sessions.map((item) => {
                const isCurrent = item.id === currentSessionId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left ${
                        isCurrent ? "border-blue bg-blue-tint" : "border-line hover:border-blue/50 hover:bg-paper"
                      }`}
                    >
                      <span className="block text-sm font-bold">{item.preview}</span>
                      <span className="mt-1 block text-xs text-ink-soft">
                        {new Date(item.updated_at).toLocaleString(undefined, DATE_FORMAT)} · {item.message_count} messages
                        · {LEVEL_LABELS[item.difficulty]}
                        {isCurrent ? " · Open now" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}