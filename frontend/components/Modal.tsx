"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** A centered dialog. Closes with Escape, the Close button, or a click outside. */
export default function Modal({ title, onClose, children }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    // Stop the page behind the dialog from scrolling.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
          <button ref={closeRef} type="button" className="btn btn-secondary px-3 py-1.5 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}