"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { useGamification } from "@/lib/gamification";
import { speak, speechSynthesisSupported, stopSpeaking, useSpeechRecognition } from "@/lib/speech";
import type { ChatMessage, LearningSession } from "@/lib/types";

import Markdown from "./Markdown";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

const SUGGESTIONS = ["Show me another example", "Can you explain that more simply?", "Give me a small exercise"];
const MAX_INPUT_HEIGHT_PX = 160;
const RESTART_LISTENING_DELAY_MS = 400;

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
  // Voice mode is hands-free: the tutor listens, sends each phrase when the learner pauses, reads the
  // reply aloud, then listens again. Listening pauses while the tutor thinks or speaks, so it never
  // hears its own voice.
  const [voiceMode, setVoiceMode] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const voiceModeRef = useRef(false);
  const sendingRef = useRef(false);
  const speakingRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => undefined);
  const voice = useSpeechRecognition({
    onFinal: (text) => {
      if (voiceModeRef.current) void send(text);
      else setInput((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
    },
    // Silence ends a listening session; in voice mode, simply start another.
    onEnd: () => resumeListening(),
    onError: (code) => {
      // Without microphone access the loop can't work, so leave voice mode instead of retrying forever.
      if (code === "not-allowed" || code === "service-not-allowed") setVoiceModeOn(false);
    },
  });
  startListeningRef.current = voice.start;
  // Checked after mounting: the server-rendered HTML can't know what the browser supports.
  const [canSpeak, setCanSpeak] = useState(false);

  useEffect(() => {
    setCanSpeak(speechSynthesisSupported());
    return () => {
      voiceModeRef.current = false;
      stopSpeaking();
    };
  }, []);

  function resumeListening() {
    // A short pause lets the browser fully close the previous listening session first.
    setTimeout(() => {
      if (voiceModeRef.current && !sendingRef.current && !speakingRef.current) startListeningRef.current();
    }, RESTART_LISTENING_DELAY_MS);
  }

  function setVoiceModeOn(on: boolean) {
    voiceModeRef.current = on;
    setVoiceMode(on);
    if (on) {
      if (voice.supported) voice.start();
    } else {
      voice.stop();
      stopSpeaking();
      speakingRef.current = false;
      setSpeakingKey(null);
    }
  }

  function speakMessage(message: ChatMessage) {
    speakingRef.current = true;
    setSpeakingKey(message.created_at);
    speak(message.content, () => {
      speakingRef.current = false;
      setSpeakingKey((current) => (current === message.created_at ? null : current));
      resumeListening();
    });
  }

  function toggleSpeaking(message: ChatMessage) {
    if (speakingKey === message.created_at) {
      stopSpeaking();
      speakingRef.current = false;
      setSpeakingKey(null);
      resumeListening();
      return;
    }
    voice.stop();
    speakMessage(message);
  }

  /** The mic button: listen now, interrupting the tutor if it's reading a reply aloud. */
  function toggleListening() {
    if (voice.listening) {
      voice.stop();
      return;
    }
    if (speakingRef.current) {
      stopSpeaking();
      speakingRef.current = false;
      setSpeakingKey(null);
    }
    voice.start();
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startedSessionRef = useRef<string | null>(null);
  const hasScrolledRef = useRef(false);
  const resumed = session.messages.length > 0;
  const { refresh: refreshGamification } = useGamification();

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
    sendingRef.current = true;
    if (trimmed) {
      setMessages((current) => [...current, { role: "student", content: trimmed, created_at: new Date().toISOString() }]);
      setInput("");
    }
    try {
      const { reply } = await api.learn(session.id, trimmed);
      setMessages((current) => [...current, reply]);
      if (voiceModeRef.current && speechSynthesisSupported()) speakMessage(reply);
      if (trimmed) refreshGamification();
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
      sendingRef.current = false;
      // Without a reply being read aloud, go straight back to listening.
      if (!speakingRef.current) resumeListening();
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

  function voiceStatus(): string {
    if (voice.listening) return voice.interim ? `Listening… ${voice.interim}` : "Listening… speak now";
    if (voiceMode && speakingKey) return "Tutor is speaking… tap 🎤 to interrupt";
    if (voiceMode && sending) return "Thinking…";
    if (voiceMode) return voice.supported ? "Voice mode is on" : "Voice mode is on: replies are read aloud";
    return `Enter to send · Shift+Enter for a new line${voice.supported ? " · 🎤 to speak" : ""}`;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
          {resumed && (
            <p className="text-center text-xs text-ink-soft">
              Continuing a saved conversation. Open History to switch, or start a new conversation.
            </p>
          )}
          {messages.map((message, index) => (
            <div key={`${message.created_at}-${index}`} className={message.role === "student" ? "flex justify-end" : ""}>
              {message.role === "student" ? (
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue px-4 py-2.5 text-on-accent">
                  {message.content}
                </p>
              ) : (
                <div>
                  <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
                    <Markdown content={message.content} />
                  </div>
                  {canSpeak && (
                    <button
                      type="button"
                      onClick={() => toggleSpeaking(message)}
                      aria-pressed={speakingKey === message.created_at}
                      className="mt-1 ml-2 text-xs font-bold text-ink-soft hover:text-ink"
                    >
                      {speakingKey === message.created_at ? "■ Stop reading" : "🔊 Listen"}
                    </button>
                  )}
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
          {(voice.supported || canSpeak) && (
            <div className="mb-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoiceModeOn(!voiceMode)}
                aria-pressed={voiceMode}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  voiceMode ? "border-blue bg-blue-tint text-blue-deep" : "border-line text-ink-soft hover:text-ink"
                }`}
                title={
                  voice.supported
                    ? "Hands-free: talk to the tutor and hear its replies"
                    : "Hear the tutor's replies read aloud"
                }
              >
                🎧 Voice mode {voiceMode ? "on" : "off"}
              </button>
            </div>
          )}
          {voice.error && (
            <div className="mb-2">
              <Alert>{voice.error}</Alert>
            </div>
          )}
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
            {voice.supported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={sending}
                aria-pressed={voice.listening}
                aria-label={voice.listening ? "Stop listening" : "Speak your message"}
                title={voice.listening ? "Stop listening" : "Speak your message"}
                className={`btn shrink-0 px-3 ${voice.listening ? "btn-primary animate-pulse" : "btn-secondary"}`}
              >
                🎤
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
          <p className="mt-1.5 text-xs text-ink-soft" aria-live="polite">
            {voiceStatus()}
          </p>
        </div>
      </div>
    </div>
  );
}