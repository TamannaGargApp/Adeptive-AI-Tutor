"use client";

import { useEffect, useRef, useState } from "react";

function remainingSeconds(until: string): number {
  return Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000));
}

function formatRemaining(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}h ${pad(minutes)}m ${pad(seconds)}s` : `${minutes}m ${pad(seconds)}s`;
}

/** Live countdown to `until` (an ISO time). Calls `onDone` once when it reaches zero. */
export default function Countdown({ until, onDone }: { until: string; onDone?: () => void }) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(until));
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    setSeconds(remainingSeconds(until));
    const timer = setInterval(() => {
      const left = remainingSeconds(until);
      setSeconds(left);
      if (left === 0) {
        clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until, onDone]);

  const opensAt = new Date(until).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <span className="font-mono font-bold" title={`Available ${opensAt}`} role="timer">
      {formatRemaining(seconds)}
    </span>
  );
}