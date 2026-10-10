import Link from "next/link";

import { courseExamLink, finalTestLink, LEVEL_LABELS, MODE_LABELS, studyLink } from "@/lib/labels";
import type { Recommendation } from "@/lib/types";

import { Icon } from "./Icon";

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
    <section className="bg-sunset relative overflow-hidden rounded-2xl p-6 shadow-[0_18px_40px_-18px_rgb(236_72_153/0.6)]" aria-labelledby="recommendation-heading">
      <div
        aria-hidden
        className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:20px_20px]"
      />
      <div className="relative">
        <h2 id="recommendation-heading" className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-white/80 uppercase">
          <Icon name="sparkle" size={14} /> Recommended next
        </h2>
        <p className="mt-2 text-2xl font-bold">{recommendation.topic_name || "Course exam"}</p>
        <p className="mt-2 max-w-prose text-white/90">{recommendation.message}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={action.href} className="btn bg-white text-[#1a2fb0] hover:bg-white/90">
            {action.label}
            <Icon name="arrow" size={16} />
          </Link>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
            {LEVEL_LABELS[recommendation.suggested_difficulty]} level
          </span>
        </div>
      </div>
    </section>
  );
}