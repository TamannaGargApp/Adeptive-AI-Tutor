import Link from "next/link";

import { courseExamLink, finalTestLink, LEVEL_LABELS, MODE_LABELS, studyLink } from "@/lib/labels";
import type { Recommendation } from "@/lib/types";

/** Where the recommendation's button goes, and what it says. */
function recommendationAction(recommendation: Recommendation): { href: string; label: string } {
  switch (recommendation.suggested_mode) {
    case "course_exam":
      return { href: courseExamLink(recommendation.subject_slug), label: "Take the course exam" };
    case "final_test":
      return { href: finalTestLink(recommendation.topic_slug), label: "Take the final test" };
    default:
      return {
        href: studyLink(recommendation.topic_slug, recommendation.suggested_mode),
        label: `Start ${MODE_LABELS[recommendation.suggested_mode].toLowerCase()}`,
      };
  }
}

export default function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const action = recommendationAction(recommendation);
  return (
    <section className="rounded-xl border-2 border-sun bg-sun-tint p-5" aria-labelledby="recommendation-heading">
      <h2 id="recommendation-heading" className="text-sm font-bold text-ink-soft">
        Recommended next
      </h2>
      <p className="mt-1 text-2xl font-bold">{recommendation.topic_name}</p>
      <p className="mt-2 max-w-prose text-ink">{recommendation.message}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={action.href} className="btn btn-primary">
          {action.label}
        </Link>
        <span className="text-sm text-ink-soft">{LEVEL_LABELS[recommendation.suggested_difficulty]} level</span>
      </div>
    </section>
  );
}