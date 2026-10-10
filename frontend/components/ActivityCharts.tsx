"use client";

import { useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import type { ActivityDay } from "@/lib/types";

import { parseDay } from "./Achievements";
import { Alert, Spinner } from "./ui";

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

function shortDate(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, SHORT_DATE);
}

/**
 * Activity over the last 30 days, across all courses. Built with plain HTML and SVG so the charts
 * follow the light/dark theme colours and need no charting library.
 */
export default function ActivityCharts() {
  const [days, setDays] = useState<ActivityDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getActivity(30)
      .then((history) => setDays(history.days))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!days) return <Spinner label="Loading your activity…" />;

  const questions = days.reduce((sum, day) => sum + day.questions, 0);
  const correct = days.reduce((sum, day) => sum + day.correct, 0);
  const activeDays = days.filter((day) => day.questions > 0 || day.learn_messages > 0).length;
  const xp = days.reduce((sum, day) => sum + day.xp, 0);

  return (
    <section className="panel space-y-6 p-5" aria-labelledby="activity-heading">
      <div>
        <h2 id="activity-heading" className="text-xl font-bold">
          Last 30 days
        </h2>
        <p className="text-sm text-ink-soft">Across all your courses</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Questions", value: questions },
          { label: "Accuracy", value: questions ? `${Math.round((correct / questions) * 100)}%` : "–" },
          { label: "Active days", value: activeDays },
          { label: "XP earned", value: xp.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="text-sm text-ink-soft">{stat.label}</dt>
            <dd className="text-2xl font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {activeDays === 0 ? (
        <p className="text-sm text-ink-soft">No activity in the last 30 days yet. Your charts appear as you learn.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <QuestionsChart days={days} />
          <AccuracyChart days={days} />
        </div>
      )}
    </section>
  );
}

function AxisDates({ days }: { days: ActivityDay[] }) {
  return (
    <p className="mt-1 flex justify-between text-xs text-ink-soft" aria-hidden>
      <span>{shortDate(days[0].date)}</span>
      <span>{shortDate(days[Math.floor(days.length / 2)].date)}</span>
      <span>Today</span>
    </p>
  );
}

function QuestionsChart({ days }: { days: ActivityDay[] }) {
  const max = Math.max(1, ...days.map((day) => day.questions));
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
        Questions per day
        <span className="flex gap-3 text-xs font-normal text-ink-soft">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm chart-correct" aria-hidden /> Correct
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm chart-wrong" aria-hidden /> Incorrect
          </span>
        </span>
      </figcaption>
      <div className="relative h-40 border-b border-l border-line pl-1" aria-hidden>
        <span className="absolute -top-1 -left-1 -translate-x-full pr-1 text-xs text-ink-soft">{max}</span>
        <div className="flex h-full items-end gap-[2px]">
          {days.map((day) => (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${shortDate(day.date)}: ${day.questions} questions, ${day.correct} correct`}
            >
              <div className="chart-wrong rounded-t-sm" style={{ height: `${((day.questions - day.correct) / max) * 100}%` }} />
              <div className="chart-correct" style={{ height: `${(day.correct / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <AxisDates days={days} />
      <ChartTable days={days} caption="Questions per day" />
    </figure>
  );
}

function AccuracyChart({ days }: { days: ActivityDay[] }) {
  const width = 300;
  const height = 100;
  const step = width / (days.length - 1);
  const points = days
    .map((day, index) => (day.accuracy === null ? null : { x: index * step, y: height - day.accuracy, day }))
    .filter((point): point is NonNullable<typeof point> => point !== null);

  return (
    <figure>
      <figcaption className="mb-2 text-sm font-bold">First-try accuracy</figcaption>
      <div className="relative h-40 border-b border-l border-line" aria-hidden>
        <span className="absolute -top-1 -left-1 -translate-x-full pr-1 text-xs text-ink-soft">100%</span>
        <span className="absolute top-1/2 -left-1 -translate-x-full -translate-y-1/2 pr-1 text-xs text-ink-soft">50%</span>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="stroke-line" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          {points.length > 1 && (
            <polyline
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              className="stroke-[#6366f1]"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Dots are HTML so they stay round while the SVG stretches to fit. */}
        {points.map((point) => (
          <span
            key={point.day.date}
            title={`${shortDate(point.day.date)}: ${point.day.accuracy}%`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ec4899] ring-2 ring-surface"
            style={{ left: `${(point.x / width) * 100}%`, top: `${(point.y / height) * 100}%` }}
          />
        ))}
      </div>
      <AxisDates days={days} />
      <ChartTable days={days} caption="First-try accuracy per day" />
    </figure>
  );
}

/** The chart data as a table for screen readers. */
function ChartTable({ days, caption }: { days: ActivityDay[]; caption: string }) {
  const active = days.filter((day) => day.questions > 0);
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>Date</th>
          <th>Questions</th>
          <th>Correct</th>
          <th>Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {active.map((day) => (
          <tr key={day.date}>
            <td>{shortDate(day.date)}</td>
            <td>{day.questions}</td>
            <td>{day.correct}</td>
            <td>{day.accuracy === null ? "–" : `${day.accuracy}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}