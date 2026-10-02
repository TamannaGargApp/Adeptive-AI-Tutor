import Link from "next/link";

import { LEVEL_LABELS, MODE_LABELS, studyLink } from "@/lib/labels";
import type { Recommendation } from "@/lib/types";

export default function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <section className="rounded-xl border-2 border-sun bg-sun-tint p-5" aria-labelledby="recommendation-heading">
      <h2 id="recommendation-heading" className="text-sm font-bold text-ink-soft">
        Recommended next
      </h2>
      <p className="mt-1 text-2xl font-bold">{recommendation.topic_name}</p>
      <p className="mt-2 max-w-prose text-ink">{recommendation.message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={studyLink(recommendation.topic_slug, recommendation.suggested_mode)} className="btn btn-primary">
          Start {MODE_LABELS[recommendation.suggested_mode].toLowerCase()}
        </Link>
        <span className="text-sm text-ink-soft">{LEVEL_LABELS[recommendation.suggested_difficulty]} level</span>
      </div>
    </section>
  );
}
