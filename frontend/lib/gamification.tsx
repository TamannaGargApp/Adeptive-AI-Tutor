"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api } from "./api";
import type { Badge, Gamification } from "./types";

interface GamificationContextValue {
  summary: Gamification | null;
  /** Reload after the learner does something that may change their streak, XP or badges. */
  refresh: () => void;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

const TOAST_DURATION_MS = 6000;

/**
 * Loads the learner's streak, level and badges once for the whole signed-in app, so the navbar,
 * dashboard and achievements page agree, and a newly earned badge is announced exactly once.
 */
export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<Gamification | null>(null);
  const [unlocked, setUnlocked] = useState<Badge[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    api
      .getGamification()
      .then((next) => {
        setSummary(next);
        if (next.newly_earned.length > 0) {
          setUnlocked(next.badges.filter((badge) => next.newly_earned.includes(badge.id)));
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setUnlocked([]), TOAST_DURATION_MS);
        }
      })
      .catch(() => {
        // Gamification is a bonus; the rest of the app works without it.
      });
  }, []);

  // Moving between pages is a natural moment to pick up new activity.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const value = useMemo(() => ({ summary, refresh }), [summary, refresh]);

  return (
    <GamificationContext.Provider value={value}>
      {children}
      {unlocked.length > 0 && <BadgeToast badges={unlocked} onClose={() => setUnlocked([])} />}
    </GamificationContext.Provider>
  );
}

export function useGamification(): GamificationContextValue {
  const context = useContext(GamificationContext);
  if (!context) throw new Error("useGamification must be used inside <GamificationProvider>.");
  return context;
}

function BadgeToast({ badges, onClose }: { badges: Badge[]; onClose: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border-2 border-sun bg-surface p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-soft">Badge unlocked!</p>
          <ul className="mt-1 space-y-1.5">
            {badges.map((badge) => (
              <li key={badge.id} className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>
                  {badge.icon}
                </span>
                <span>
                  <span className="block font-bold">{badge.name}</span>
                  <span className="block text-sm text-ink-soft">{badge.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="text-ink-soft hover:text-ink">
          ✕
        </button>
      </div>
    </div>
  );
}