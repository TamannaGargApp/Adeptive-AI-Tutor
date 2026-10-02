import type { CompletionStatus, LearningGoal, LearningMode, Level, Mastery } from "./types";

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const GOAL_LABELS: Record<LearningGoal, string> = {
  learn_python: "Learn Python",
  improve_problem_solving: "Improve problem solving",
  interview_preparation: "Interview preparation",
};

export const MODE_LABELS: Record<LearningMode, string> = {
  learn: "Learn",
  practice: "Practice",
  quiz: "Quiz",
};

export const MODE_DESCRIPTIONS: Record<LearningMode, string> = {
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
export const MODES: LearningMode[] = ["learn", "practice", "quiz"];

/** Where to send the learner for a given topic and mode. Quizzes have their own page. */
export function studyLink(topicSlug: string, mode: LearningMode): string {
  const path = mode === "quiz" ? "/quiz" : "/tutor";
  const query = new URLSearchParams({ topic: topicSlug });
  if (mode !== "quiz") query.set("mode", mode);
  return `${path}?${query.toString()}`;
}