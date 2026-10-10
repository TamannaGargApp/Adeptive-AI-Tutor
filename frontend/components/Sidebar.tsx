"use client";

import { LEVEL_LABELS, LEVELS, MODE_DESCRIPTIONS, MODE_LABELS, MODES } from "@/lib/labels";
import type { Level, StudyMode, Topic } from "@/lib/types";

import { Icon, type IconName } from "./Icon";
import { Segmented } from "./ui";

/** Each study mode has its own colour: Read sky, Learn indigo, Practice orange, Quiz pink. */
export const MODE_TILES: Record<StudyMode, string> = {
  read: "tile-cyan",
  learn: "tile-blue",
  practice: "tile-amber",
  quiz: "tile-magenta",
};

export const MODE_ICONS: Record<StudyMode, IconName> = { read: "book", learn: "chat", practice: "target", quiz: "quiz" };

interface SidebarProps {
  topics: Topic[];
  topicSlug: string;
  mode: StudyMode;
  difficulty: Level | null;
  onTopicChange: (slug: string) => void;
  onModeChange: (mode: StudyMode) => void;
  onDifficultyChange: (difficulty: Level) => void;
  /** On small screens the sidebar is a collapsible panel; on large screens it is always shown. */
  mobileOpen: boolean;
}

export default function Sidebar({
  topics,
  topicSlug,
  mode,
  difficulty,
  onTopicChange,
  onModeChange,
  onDifficultyChange,
  mobileOpen,
}: SidebarProps) {
  return (
    <aside
      id="tutor-settings"
      className={`space-y-7 border-b border-line bg-surface/75 p-4 lg:block lg:max-h-none lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 ${
        mobileOpen ? "max-h-[45dvh] shrink-0 overflow-y-auto" : "hidden"
      }`}
    >
      <section>
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-soft uppercase">Topic</h2>
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
          {topics.map((topic, index) => {
            const current = topic.slug === topicSlug;
            return (
              <li key={topic.slug}>
                <button
                  type="button"
                  onClick={() => onTopicChange(topic.slug)}
                  aria-current={current ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    current ? "bg-violet-tint font-bold text-ink" : "text-ink hover:bg-paper"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${
                      current ? "bg-brand" : "bg-paper text-ink-soft"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-soft uppercase">Learning mode</h2>
        <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-1">
          {MODES.map((item) => {
            const selected = item === mode;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onModeChange(item)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors ${
                  selected ? "border-violet/40 bg-violet-tint" : "border-line hover:border-violet/40 hover:bg-paper"
                }`}
              >
                <span
                  aria-hidden
                  className={`hidden h-9 w-9 shrink-0 place-items-center rounded-lg transition-opacity lg:grid ${MODE_TILES[item]} ${
                    selected ? "" : "opacity-75"
                  }`}
                >
                  <Icon name={MODE_ICONS[item]} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{MODE_LABELS[item]}</span>
                  <span className="hidden text-xs text-ink-soft lg:block">{MODE_DESCRIPTIONS[item]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-soft uppercase">Difficulty</h2>
        <Segmented
          label="Difficulty"
          size="sm"
          value={difficulty}
          onChange={onDifficultyChange}
          options={LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level] }))}
        />
        <p className="mt-2 px-1 text-xs text-ink-soft">Adjusts automatically as you practice.</p>
      </section>
    </aside>
  );
}