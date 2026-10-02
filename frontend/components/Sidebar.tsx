"use client";

import { LEVEL_LABELS, LEVELS, MODE_DESCRIPTIONS, MODE_LABELS, MODES } from "@/lib/labels";
import type { LearningMode, Level, Topic } from "@/lib/types";

interface SidebarProps {
  topics: Topic[];
  topicSlug: string;
  mode: LearningMode;
  difficulty: Level | null;
  onTopicChange: (slug: string) => void;
  onModeChange: (mode: LearningMode) => void;
  onDifficultyChange: (difficulty: Level) => void;
}

export default function Sidebar({
  topics,
  topicSlug,
  mode,
  difficulty,
  onTopicChange,
  onModeChange,
  onDifficultyChange,
}: SidebarProps) {
  return (
    <aside className="space-y-6 border-b border-line bg-surface p-4 lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-soft">Topic</h2>
        <label htmlFor="topic-select" className="sr-only">
          Topic
        </label>
        <select
          id="topic-select"
          className="input lg:hidden"
          value={topicSlug}
          onChange={(event) => onTopicChange(event.target.value)}
        >
          {topics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </select>
        <ul className="hidden space-y-0.5 lg:block">
          {topics.map((topic) => (
            <li key={topic.slug}>
              <button
                type="button"
                onClick={() => onTopicChange(topic.slug)}
                aria-current={topic.slug === topicSlug ? "true" : undefined}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  topic.slug === topicSlug ? "bg-blue-tint font-bold text-blue-deep" : "text-ink hover:bg-paper"
                }`}
              >
                {topic.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-soft">Learning mode</h2>
        <div className="grid grid-cols-3 gap-1 lg:grid-cols-1">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              aria-pressed={item === mode}
              className={`rounded-md px-3 py-2 text-left text-sm ${
                item === mode ? "bg-blue text-white" : "border border-line hover:border-blue/50"
              }`}
            >
              <span className="block font-bold">{MODE_LABELS[item]}</span>
              <span className={`hidden text-xs lg:block ${item === mode ? "text-white/80" : "text-ink-soft"}`}>
                {MODE_DESCRIPTIONS[item]}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-soft">Difficulty</h2>
        <div className="grid grid-cols-3 gap-1">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onDifficultyChange(level)}
              aria-pressed={level === difficulty}
              className={`break-words rounded-md px-1.5 py-1.5 text-center text-[11px] leading-tight font-bold ${
                level === difficulty ? "bg-ink text-white" : "border border-line text-ink-soft hover:border-ink/40"
              }`}
            >
              {LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">Adjusts automatically as you practice.</p>
      </section>
    </aside>
  );
}
