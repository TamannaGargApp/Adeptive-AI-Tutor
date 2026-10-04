"use client";

/**
 * Voice features built on the browser's own speech APIs, so they need no backend or API key.
 * - Speech recognition (speaking to the tutor) works in Chrome and Edge. In Chrome the audio is
 *   processed by the browser vendor's speech service.
 * - Speech synthesis (reading replies aloud) works in all modern browsers.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings: the Web Speech recognition API isn't in TypeScript's standard DOM types.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

interface RecognitionHandlers {
  /** A finished phrase (the learner paused after speaking). */
  onFinal: (text: string) => void;
  /** Listening stopped, for any reason. Used to start listening again in hands-free mode. */
  onEnd?: () => void;
  /** Listening can't continue, e.g. the microphone is blocked ("not-allowed"). */
  onError?: (code: string) => void;
}

/** Dictation: reports each finished phrase; `interim` shows words as they're heard. */
export function useSpeechRecognition(handlers: RecognitionHandlers) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  // Tracks the live session directly, since state updates arrive too late to prevent a double start.
  const activeRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const RecognitionClass = getRecognition();
    if (!RecognitionClass || activeRef.current) return;
    const recognition = new RecognitionClass();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) handlersRef.current.onFinal(finalText.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      handlersRef.current.onError?.(event.error);
      setError(
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow it in your browser's site settings to talk to the tutor."
          : "Voice input stopped unexpectedly. Please try again.",
      );
    };
    recognition.onend = () => {
      activeRef.current = false;
      setListening(false);
      setInterim("");
      handlersRef.current.onEnd?.();
    };
    recognitionRef.current = recognition;
    setError(null);
    activeRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      // Starting while the browser is still closing the previous session; the next attempt will work.
      activeRef.current = false;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { supported, listening, interim, error, start, stop };
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Turn a Markdown reply into natural speech: code blocks are announced, not read symbol by symbol. */
export function markdownToSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code example shown on screen) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>~|]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, onEnd?: () => void) {
  if (!speechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(markdownToSpeech(text));
  utterance.lang = navigator.language || "en-US";
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}