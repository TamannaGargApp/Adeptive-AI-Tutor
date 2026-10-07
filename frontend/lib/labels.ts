import type { CompletionStatus, LearningGoal, Level, Mastery, PlanTask, StudyMode } from "./types";

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const GOAL_LABELS: Record<LearningGoal, string> = {
  learn_python: "Learn a new language",
  improve_problem_solving: "Improve problem solving",
  interview_preparation: "Interview preparation",
};

export const MODE_LABELS: Record<StudyMode, string> = {
  read: "Read",
  learn: "Learn",
  practice: "Practice",
  quiz: "Quiz",
};

export const MODE_DESCRIPTIONS: Record<StudyMode, string> = {
  read: "Study notes for the whole topic",
  learn: "Explanations and examples at your pace",
  practice: "One question at a time, with hints",
  quiz: "Five questions and a score",
};

export const MASTERY_LABELS: Record<Mastery, string> = {
  not_started: "Not started",
  needs_practice: "Needs practice",
  developing: "Developing",
  strong: "Strong",
  mastered: "Mastered",
};

export const COMPLETION_LABELS: Record<CompletionStatus, string> = {
  not_started: "Not started",
  needs_practice: "Needs more practice",
  in_progress: "In progress",
  almost_complete: "Almost complete",
  complete: "Complete",
};

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
export const MODES: StudyMode[] = ["read", "learn", "practice", "quiz"];

/** Where to send the learner for a given topic and mode. Quizzes have their own page. */
export function studyLink(topicSlug: string, mode: StudyMode): string {
  const path = mode === "quiz" ? "/quiz" : "/tutor";
  const query = new URLSearchParams({ topic: topicSlug });
  if (mode !== "quiz") query.set("mode", mode);
  return `${path}?${query.toString()}`;
}

export function finalTestLink(topicSlug: string): string {
  return `/final-test?${new URLSearchParams({ topic: topicSlug }).toString()}`;
}

/** Formats seconds as m:ss, e.g. 754 -> "12:34". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function courseExamLink(subjectSlug: string): string {
  return `/final-test?${new URLSearchParams({ course: subjectSlug }).toString()}`;
}

/** Failing rules; must match progress_service.py on the backend. */
export const FAILS_BEFORE_COOLDOWN = 3;
export const RETRY_COOLDOWN_HOURS = 12;

/** Where a study plan task takes the learner. */
export function planTaskLink(task: PlanTask): string {
  switch (task.type) {
    case "final_test":
      return finalTestLink(task.topic_slug);
    case "course_exam":
      return courseExamLink(task.subject_slug);
    default:
      return studyLink(task.topic_slug, task.type);
  }
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Parse "2026-10-05" as a local date (new Date("2026-10-05") would be midnight UTC). */
export function parseLocalDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}