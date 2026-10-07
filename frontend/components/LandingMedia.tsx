"use client";

import { useState } from "react";

/**
 * A product screenshot for the landing page. Until the image file exists in public/screenshots/,
 * a labelled placeholder of the same shape is shown, so the page always looks finished.
 *
 * With `fill`, the screenshot fills its container (cropped around `focus`), for feature cards.
 */
export function Screenshot({
  file,
  alt,
  label,
  fill = false,
  focus = "top",
}: {
  file: string;
  alt: string;
  label: string;
  fill?: boolean;
  /** With `fill`: which part of the image stays visible when cropped (CSS object-position). */
  focus?: string;
}) {
  const [missing, setMissing] = useState(false);
  const src = `/screenshots/${file}`;

  if (missing) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-dots grid w-full place-items-center border-2 border-dashed border-line bg-surface p-6 text-center ${
          fill ? "h-full rounded-t-xl" : "aspect-[16/10] rounded-2xl"
        }`}
      >
        <span>
          <span className="block text-sm font-bold text-ink-soft">Screenshot: {label}</span>
          <span className="mt-1 block font-mono text-xs text-ink-soft">public/screenshots/{file}</span>
        </span>
      </div>
    );
  }

  const chrome = (
    <div aria-hidden className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
      <span className="h-2.5 w-2.5 rounded-full bg-sun/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-good/60" />
    </div>
  );

  if (fill) {
    return (
      <figure className="flex h-full flex-col overflow-hidden rounded-t-xl border border-b-0 border-line bg-surface">
        {chrome}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setMissing(true)}
          className="min-h-0 w-full flex-1 object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ objectPosition: focus }}
          loading="lazy"
        />
      </figure>
    );
  }

  return (
    // Framed like a browser window so screenshots read as the real app.
    <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
      {chrome}
      {/* A plain img (not next/image) so a missing file can fall back to the placeholder. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onError={() => setMissing(true)} className="block w-full" loading="lazy" />
    </figure>
  );
}

/** The optional demo video, set with NEXT_PUBLIC_DEMO_VIDEO_URL (a YouTube link or an .mp4 URL). */
export function DemoVideo() {
  const url = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;
  if (!url) return null;
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  return (
    <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-2xl border border-line bg-code shadow-[var(--shadow-lift)]">
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