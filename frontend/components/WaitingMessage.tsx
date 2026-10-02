"use client";

import { useEffect, useState } from "react";

import { Spinner } from "./ui";

const BUSY_AFTER_SECONDS = 8;
const SLOW_AFTER_SECONDS = 25;

/**
 * A spinner for AI requests that explains longer waits, so a slow response
 * doesn't look like the app has frozen. Requests always end with an answer or
 * an error message because the API client enforces a time limit.
 */
export default function WaitingMessage({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  let note: string | null = null;
  if (seconds >= SLOW_AFTER_SECONDS) {
    note = "This is taking longer than usual. If it doesn't finish soon, you'll be able to try again.";
  } else if (seconds >= BUSY_AFTER_SECONDS) {
    note = "Still working. The AI service is busier than usual right now.";
  }

  return (
    <div className="space-y-1" aria-live="polite">
      <Spinner label={label} />
      {note && <p className="pl-8 text-sm text-ink-soft">{note}</p>}
    </div>
  );
}
