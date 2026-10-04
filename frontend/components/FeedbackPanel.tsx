"use client";

import { useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import type { FeedbackReport } from "@/lib/types";

import { Alert, Spinner } from "./ui";
import WaitingMessage from "./WaitingMessage";

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
// Remembers whether the learner collapsed the panel.
const OPEN_STORAGE_KEY = "feedback-panel-open";

/** The AI coach report for the current course: strengths, mistake patterns, and what to do next. */
export default function FeedbackPanel({ subjectSlug }: { subjectSlug: string }) {
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_STORAGE_KEY) !== "false");
    } catch {
      // Storage unavailable: keep the default.
    }
  }, []);

  function toggleOpen() {
    setOpen((current) => {
      try {
        localStorage.setItem(OPEN_STORAGE_KEY, String(!current));
      } catch {
        // Not saved, but still toggled for this visit.
      }
      return !current;
    });
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getFeedback()
      .then(setReport)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [subjectSlug]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      setReport(await api.createFeedback());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = !report || report.can_refresh;

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="feedback-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="feedback-heading" className="text-xl font-bold">
            <button
              type="button"
              onClick={toggleOpen}
              aria-expanded={open}
              aria-controls="feedback-details"
              className="flex items-center gap-2 text-left hover:text-blue-deep"
            >
              <span
                aria-hidden
                className={`inline-block text-base text-ink-soft transition-transform ${open ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              Personalized feedback
              <span className="sr-only">{open ? " (collapse)" : " (expand)"}</span>
            </button>
          </h2>
          <p className="text-sm text-ink-soft">
            {report
              ? `Based on ${report.based_on_answers} answers · ${new Date(report.created_at).toLocaleString(undefined, DATE_FORMAT)}`
              : "Your AI coach looks at your answers and progress and tells you what to work on."}
          </p>
        </div>
        {!loading && (
          <button
            type="button"
            className={`btn ${report ? "btn-secondary" : "btn-primary"} px-3 py-1.5 text-sm`}
            onClick={generate}
            disabled={generating || !canGenerate}
            title={canGenerate ? undefined : "Answer more questions to get an updated report."}
          >
            {report ? "Refresh feedback" : "Get my feedback"}
          </button>
        )}
      </div>

      <div id="feedback-details" hidden={!open} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {loading && <Spinner />}
        {generating && <WaitingMessage label="Analysing your answers…" />}
        {report && !canGenerate && !generating && (
          <p className="text-xs text-ink-soft">This is up to date. Answer more questions to refresh it.</p>
        )}

        {report && !generating && (
          <div className="space-y-4">
            <p className="text-lg">{report.report.summary}</p>

            <div className="grid gap-4 md:grid-cols-2">
              <FeedbackList title="What you do well" items={report.report.strengths} tone="good" />
              <FeedbackList title="Mistake patterns" items={report.report.mistake_patterns} tone="bad" />
            </div>

            {report.report.areas_to_improve.length > 0 && (
              <div>
                <h3 className="mb-2 font-bold">Areas to improve</h3>
                <ul className="space-y-2">
                  {report.report.areas_to_improve.map((item) => (
                    <li key={item.area} className="rounded-lg border-l-4 border-sun bg-sun-tint px-4 py-3 text-sm">
                      <p className="font-bold">{item.area}</p>
                      <p className="text-ink">{item.why}</p>
                      <p className="mt-1 text-ink">
                        <span className="font-bold">Try: </span>
                        {item.how}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-1 font-bold">Next steps</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {report.report.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <p className="text-sm font-bold text-good">{report.report.encouragement}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  return (
    <div>
      <h3 className="mb-1 font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing clear yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className={tone === "good" ? "text-good" : "text-bad"} aria-hidden>
                {tone === "good" ? "✓" : "•"}
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}