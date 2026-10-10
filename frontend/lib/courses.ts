import type { IconName } from "@/components/Icon";

/**
 * Display helpers for courses. Courses come from the server, so nothing here assumes which
 * courses exist: any new course gets a sensible icon and label without code changes.
 */

// Words in a course's slug or name that suggest a more specific icon. Anything else gets "code".
const ICON_HINTS: [RegExp, IconName][] = [
  [/pandas|data|analys|statistic/, "chart"],
  [/machine|\bml\b|\bai\b|neural/, "sparkle"],
  [/flask|django|web|api|html|css|react/, "compass"],
  [/oop|object|class|design/, "layers"],
  [/javascript|typescript|\bjs\b|node/, "bolt"],
];

/** An icon for a course, picked from words in its slug or name. */
export function courseIcon(slugOrName: string): IconName {
  const text = slugOrName.toLowerCase().replace(/[-_]/g, " ");
  return ICON_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "code";
}

/** A readable name for a course's language, e.g. "python" → "Python". */
export function languageLabel(language: string | null | undefined): string {
  if (!language) return "";
  const known: Record<string, string> = { javascript: "JavaScript", typescript: "TypeScript" };
  return known[language] ?? language.charAt(0).toUpperCase() + language.slice(1);
}
