"use client";

import { useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import type { ChatMessage, LearningSession } from "@/lib/types";

import Markdown from "./Markdown";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

const SUGGESTIONS = ["Show me another example", "Can you explain that more simply?", "Give me a small exercise"];

export default function ChatWindow({ session }: { session: LearningSession }) {
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The message that failed to send ("" means the lesson introduction), so it can be retried.
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const startedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    setError(null);
    setFailedMessage(null);
    setSending(true);
    if (trimmed) {
      setMessages((current) => [...current, { role: "student", content: trimmed, created_at: new Date().toISOString() }]);
      setInput("");
    }
    try {
      const { reply } = await api.learn(session.id, trimmed);
      setMessages((current) => [...current, reply]);
    } catch (err) {
      setError(errorMessage(err));
      setFailedMessage(trimmed);
      if (trimmed) {
        // Put the message back so the learner can retry without retyping it.
        setMessages((current) => current.slice(0, -1));
        setInput(trimmed);
      }
    } finally {
      setSending(false);
    }
  }

  function retry(message: string) {
    setInput("");
    void send(message);
  }

  useEffect(() => {
    // Open a new session with the tutor's introduction. The ref prevents a duplicate
    // request from React's development double-render.
    if (session.messages.length > 0 || startedSessionRef.current === session.id) return;
    startedSessionRef.current = session.id;
    void send("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.trim() && !sending) void send(input);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.created_at}-${index}`} className={message.role === "student" ? "flex justify-end" : ""}>
            {message.role === "student" ? (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue px-4 py-2.5 text-white">
                {message.content}
              </p>
            ) : (
              <div className="max-w-[min(100%,46rem)] rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
                <Markdown content={message.content} />
              </div>
            )}
          </div>
        ))}
        {sending && <WaitingMessage label="Tutor is thinking…" />}
        {error && (
          <Alert>
            {error}{" "}
            {failedMessage !== null && (
              <button type="button" className="font-bold underline" onClick={() => retry(failedMessage)}>
                Try again
              </button>
            )}
          </Alert>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-surface p-3 sm:p-4">
        {messages.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={sending}
                onClick={() => send(suggestion)}
                className="whitespace-nowrap rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-blue hover:text-blue-deep disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim() && !sending) void send(input);
          }}
        >
          <label htmlFor="tutor-message" className="sr-only">
            Message the tutor
          </label>
          <textarea
            id="tutor-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Ask a question or answer the tutor…"
            className="input max-h-40 min-h-[2.75rem] resize-none"
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
