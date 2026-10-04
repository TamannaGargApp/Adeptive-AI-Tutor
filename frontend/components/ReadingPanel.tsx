"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { studyLink } from "@/lib/labels";
import type { TopicMaterial } from "@/lib/types";

import Markdown from "./Markdown";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

/** A topic's study notes, with key takeaways and links to practise what was read. */
export default function ReadingPanel({ topicSlug }: { topicSlug: string }) {
  const [material, setMaterial] = useState<TopicMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setMaterial(null);
    setError(null);
    api
      .getTopicMaterial(topicSlug)
      .then(setMaterial)
      .catch((err) => setError(errorMessage(err)));
  }, [topicSlug, attempt]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6">
        <Alert>{error}</Alert>
        <button type="button" className="btn btn-secondary" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <WaitingMessage label="Preparing the study notes… (this only takes a while the first time)" />
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-bold text-ink-soft">Study notes</p>
        <h2 className="text-3xl font-bold">{material.topic_name}</h2>
      </header>

      {material.key_takeaways.length > 0 && (
        <section className="rounded-lg border-l-4 border-sun bg-sun-tint px-4 py-3" aria-labelledby="takeaways-heading">
          <h3 id="takeaways-heading" className="font-bold">
            Key takeaways
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {material.key_takeaways.map((takeaway) => (
              <li key={takeaway}>{takeaway}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Headings in the notes are styled here; code blocks get a Run button from Markdown. */}
      <div className="leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold">
        <Markdown content={material.content} />
      </div>

      <footer className="panel flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-0 flex-1 font-bold">Ready to check what you&apos;ve read?</p>
        <Link href={studyLink(topicSlug, "learn")} className="btn btn-secondary px-3 py-1.5 text-sm">
          Ask the tutor
        </Link>
        <Link href={studyLink(topicSlug, "practice")} className="btn btn-primary px-3 py-1.5 text-sm">
          Practice
        </Link>
      </footer>
    </article>
  );
}