"use client";

import { useState } from "react";

/**
 * A product screenshot for the landing page. Until the image file exists in public/screenshots/,
 * a labelled placeholder of the same shape is shown, so the page always looks finished.
 */
export function Screenshot({ file, alt, label }: { file: string; alt: string; label: string }) {
  const [missing, setMissing] = useState(false);
  const src = `/screenshots/${file}`;

  if (missing) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="grid aspect-[16/10] w-full place-items-center rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center"
      >
        <span>
          <span className="block text-sm font-bold text-ink-soft">Screenshot: {label}</span>
          <span className="mt-1 block font-mono text-xs text-ink-soft">public/screenshots/{file}</span>
        </span>
      </div>
    );
  }
  return (
    // A plain img (not next/image) so a missing file can fall back to the placeholder.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setMissing(true)}
      className="w-full rounded-2xl border border-line shadow-xl shadow-black/10"
      loading="lazy"
    />
  );
}

/** The optional demo video, set with NEXT_PUBLIC_DEMO_VIDEO_URL (a YouTube link or an .mp4 URL). */
export function DemoVideo() {
  const url = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;
  if (!url) return null;
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  return (
    <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-2xl border border-line bg-code shadow-xl shadow-black/15">
      {youtube ? (
        <iframe
          className="aspect-video w-full"
          src={`https://www.youtube-nocookie.com/embed/${youtube[1]}`}
          title="Adaptive AI Tutor demo"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video className="aspect-video w-full" src={url} controls preload="metadata" />
      )}
    </div>
  );
}