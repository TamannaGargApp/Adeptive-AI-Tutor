"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import type { ChatMessage, LearningSession } from "@/lib/types";

import Markdown from "./Markdown";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

const SUGGESTIONS = ["Show me another example", "Can you explain that more simply?", "Give me a small exercise"];
const MAX_INPUT_HEIGHT_PX = 160;

/**
 * Chat layout: the component fills its parent's height. Only the message list scrolls;
 * the input stays pinned at the bottom, like ChatGPT or Claude.
 */
export default function ChatWindow({ session }: { session: LearningSession }) {
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The message that failed to send ("" means the lesson introduction), so it can be retried.
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startedSessionRef = useRef<string | null>(null);
  const hasScrolledRef = useRef(false);
  const resumed = session.messages.length > 0;

  // Keep the newest message in view. Jump instantly on first load, scroll smoothly afterwards.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: hasScrolledRef.current ? "smooth" : "auto" });
    hasScrolledRef.current = true;
  }, [messages, sending, error]);

  // Grow the input with its content, up to a limit, then let it scroll.
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`;
  }, [input]);

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
    // Open a new conversation with the tutor's introduction. The ref prevents a duplicate
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
          {resumed && (
            <p className="text-center text-xs text-ink-soft">
              Continuing your previous conversation. Use &ldquo;New conversation&rdquo; to start over.
            </p>
          )}
          {messages.map((message, index) => (
            <div key={`${message.created_at}-${index}`} className={message.role === "student" ? "flex justify-end" : ""}>
              {message.role === "student" ? (
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue px-4 py-2.5 text-on-accent">
                  {message.content}
                </p>
              ) : (
                <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
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
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-3xl p-3 sm:p-4">
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
              ref={inputRef}
              id="tutor-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="Ask a question or answer the tutor…"
              className="input resize-none overflow-y-auto"
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
          <p className="mt-1.5 text-xs text-ink-soft">Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>
    </div>
  );
}