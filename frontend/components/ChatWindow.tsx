"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { ACCEPTED_FILES, type Attachment, loadAttachments, MAX_ATTACHMENTS, readAttachment, saveAttachments } from "@/lib/attachments";
import { useGamification } from "@/lib/gamification";
import { speak, speechSynthesisSupported, stopSpeaking, useSpeechRecognition } from "@/lib/speech";
import type { ChatMessage, LearningSession } from "@/lib/types";

import Markdown from "./Markdown";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

const MAX_INPUT_HEIGHT_PX = 160;

const PAPERCLIP_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6L15 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MIC_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
  </svg>
);

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  return (
    <li
      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs"
      title={attachment.truncated ? "Long file: only the beginning is used" : undefined}
    >
      <span>
        📎 <span className="font-bold">{attachment.name}</span>
        {attachment.pages ? ` · ${attachment.pages} page${attachment.pages === 1 ? "" : "s"}` : ""}
        {attachment.truncated ? " · partly used" : ""}
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${attachment.name}`} className="text-ink-soft hover:text-bad">
        ✕
      </button>
    </li>
  );
}
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
  // Attached files live in this browser only (IndexedDB), linked to the conversation; the server
  // receives their text with each question but never stores it. `newFiles` are the names attached
  // since the last message, so that message can show them.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  // The files already sent in this conversation are listed in a collapsible line above the input.
  const [showConversationFiles, setShowConversationFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadAttachments(session.id).then(setAttachments);
  }, [session.id]);

  async function attachFiles(files: File[]) {
    setAttachError(null);
    setAttaching(true);
    let next = attachments;
    const added: string[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const replacing = next.some((item) => item.name === file.name);
      if (!replacing && next.length >= MAX_ATTACHMENTS) {
        problems.push(`${file.name} wasn't added: a conversation can have up to ${MAX_ATTACHMENTS} files.`);
        continue;
      }
      try {
        const attachment = await readAttachment(file);
        next = [...next.filter((item) => item.name !== attachment.name), attachment];
        added.push(attachment.name);
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `${file.name} couldn't be read.`);
      }
    }
    setAttachments(next);
    setNewFiles((current) => [...current.filter((name) => !added.includes(name)), ...added]);
    if (problems.length) setAttachError(problems.join(" "));
    await saveAttachments(session.id, next);
    setAttaching(false);
  }

  async function removeAttachment(name: string) {
    const next = attachments.filter((item) => item.name !== name);
    setAttachments(next);
    setNewFiles((current) => current.filter((item) => item !== name));
    await saveAttachments(session.id, next);
  }

  // Files this conversation used that aren't in this browser (e.g. opened on another device).
  const attachedNames = new Set(attachments.map((item) => item.name));
  const missingFiles = [
    ...new Set(messages.flatMap((message) => message.attachments ?? []).filter((name) => !attachedNames.has(name))),
  ];
  const pendingFiles = attachments.filter((item) => newFiles.includes(item.name));
  const conversationFiles = attachments.filter((item) => !newFiles.includes(item.name));
  const canSend = !sending && (input.trim().length > 0 || newFiles.length > 0);

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
    const sentFiles = newFiles;
    // A newly attached file can be sent on its own; the tutor is asked to take a look at it.
    const trimmed = text.trim() || (sentFiles.length ? "Please take a look at the file I attached." : "");
    setError(null);
    setFailedMessage(null);
    setSending(true);
    sendingRef.current = true;
    if (trimmed) {
      setMessages((current) => [
        ...current,
        { role: "student", content: trimmed, created_at: new Date().toISOString(), attachments: sentFiles },
      ]);
      setInput("");
      setNewFiles([]);
    }
    try {
      const { reply } = await api.learn(
        session.id,
        trimmed,
        attachments.map((item) => ({ name: item.name, text: item.text, new: sentFiles.includes(item.name) })),
      );
      setMessages((current) => [...current, reply]);
      if (voiceModeRef.current && speechSynthesisSupported()) speakMessage(reply);
      if (trimmed) refreshGamification();
    } catch (err) {
      setError(errorMessage(err));
      setFailedMessage(trimmed);
      if (trimmed) {
        // Put the message back so the learner can retry without retyping it.
        setMessages((current) => current.slice(0, -1));
        setNewFiles(sentFiles);
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
      if (canSend) void send(input);
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
        <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
          {resumed && (
            <p className="text-center text-xs text-ink-soft">
              Continuing a saved conversation. Open History to switch, or start a new conversation.
            </p>
          )}
          {messages.map((message, index) => (
            <div key={`${message.created_at}-${index}`} className={message.role === "student" ? "flex justify-end" : ""}>
              {message.role === "student" ? (
                <div className="flex max-w-[85%] flex-col items-end gap-1">
                  <p className="whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue px-4 py-2.5 text-on-accent">
                    {message.content}
                  </p>
                  {(message.attachments ?? []).map((name) => (
                    <span key={name} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft">
                      📎 {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
                    <Markdown content={message.content} />
                  </div>
                  {/* The server only sends sources to admins; learners never receive them. */}
                  {(message.notes_sources?.length ?? 0) > 0 && (
                    <p className="mt-1 ml-2 text-xs text-ink-soft">
                      📘 From course notes: {message.notes_sources?.join(", ")}
                    </p>
                  )}
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
        <div className="mx-auto w-full max-w-4xl p-3 sm:p-4">
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
            </div>
          )}
          {attachError && (
            <div className="mb-2">
              <Alert>{attachError}</Alert>
            </div>
          )}
          {missingFiles.length > 0 && (
            <p className="mb-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-soft">
              This conversation used {missingFiles.join(", ")}, which isn&apos;t saved in this browser. Attach it again to
              keep asking about it.
            </p>
          )}
          {conversationFiles.length > 0 && (
            <div className="mb-2 text-xs text-ink-soft">
              <button
                type="button"
                onClick={() => setShowConversationFiles((current) => !current)}
                aria-expanded={showConversationFiles}
                className="font-bold hover:text-ink"
              >
                📎 {conversationFiles.length} file{conversationFiles.length === 1 ? "" : "s"} in this conversation{" "}
                <span aria-hidden>{showConversationFiles ? "▴" : "▾"}</span>
              </button>
              {showConversationFiles && (
                <div className="mt-2 space-y-1.5">
                  <ul className="flex flex-wrap gap-2" aria-label="Files in this conversation">
                    {conversationFiles.map((item) => (
                      <AttachmentChip key={item.name} attachment={item} onRemove={() => void removeAttachment(item.name)} />
                    ))}
                  </ul>
                  <p>The tutor can answer follow-up questions about these. They stay in this browser only.</p>
                </div>
              )}
            </div>
          )}

          {/* One rounded box holding the attach button, the message, the mic and Send, like a chat app. */}
          <form
            className="rounded-2xl border border-line bg-paper transition-colors focus-within:border-blue"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSend) void send(input);
            }}
          >
            {pendingFiles.length > 0 && (
              <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Files to send">
                {pendingFiles.map((item) => (
                  <AttachmentChip key={item.name} attachment={item} onRemove={() => void removeAttachment(item.name)} />
                ))}
              </ul>
            )}
            <div className="flex items-end gap-1 p-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILES}
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length) void attachFiles(files);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || attaching}
                aria-label="Attach files"
                title="Attach PDF, text or code files (kept in this browser only)"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-50"
              >
                {attaching ? <span className="text-sm">…</span> : PAPERCLIP_ICON}
              </button>
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
                placeholder={pendingFiles.length ? "Ask about your file…" : "Ask a question or answer the tutor…"}
                className="max-h-40 min-h-10 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 leading-6 focus:outline-none"
              />
              {voice.supported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={sending}
                  aria-pressed={voice.listening}
                  aria-label={voice.listening ? "Stop listening" : "Speak your message"}
                  title={voice.listening ? "Stop listening" : "Speak your message"}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    voice.listening ? "animate-pulse bg-blue text-on-accent" : "text-ink-soft hover:bg-surface hover:text-ink"
                  }`}
                >
                  {MIC_ICON}
                </button>
              )}
              <button type="submit" className="btn btn-primary h-10 shrink-0 px-4" disabled={!canSend}>
                Send
              </button>
            </div>
          </form>
          <p className="mt-1.5 text-xs text-ink-soft" aria-live="polite">
            {voiceStatus()}
          </p>
        </div>
      </div>
    </div>
  );
}