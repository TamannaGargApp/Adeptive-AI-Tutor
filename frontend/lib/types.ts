export type Level = "beginner" | "intermediate" | "advanced";
export type LearningGoal = "learn_python" | "improve_problem_solving" | "interview_preparation";
export type LearningMode = "learn" | "practice" | "quiz";
export type QuestionType = "multiple_choice" | "predict_output" | "short_answer";
export type Mastery = "not_started" | "needs_practice" | "developing" | "strong" | "mastered";
export type CompletionStatus = "not_started" | "needs_practice" | "in_progress" | "almost_complete" | "complete";

export interface User {
  id: string;
  name: string;
  email: string;
  level: Level | null;
  goal: LearningGoal | null;
  preferred_difficulty: Level | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface ProfileUpdate {
  name: string;
  level: Level;
  goal: LearningGoal;
  preferred_difficulty: Level;
}

export interface Topic {
  slug: string;
  name: string;
  description: string;
  key_concepts: string[];
  order: number;
}

export interface ChatMessage {
  role: "student" | "tutor";
  content: string;
  created_at: string;
}

export interface LearningSession {
  id: string;
  topic_slug: string;
  mode: LearningMode;
  difficulty: Level;
  messages: ChatMessage[];
  created_at: string;
}

export interface LearnReply {
  session_id: string;
  reply: ChatMessage;
}

export interface Question {
  id: string;
  topic_slug: string;
  difficulty: Level;
  question_type: QuestionType;
  prompt: string;
  code: string | null;
  options: string[];
  concept: string;
}

export interface EvaluationResult {
  question_id: string;
  correct: boolean;
  score: number;
  feedback: string;
  hint: string | null;
  correct_answer: string | null;
  explanation: string | null;
  concept: string;
  difficulty: Level;
  attempt_number: number;
  can_retry: boolean;
  next_difficulty: Level;
  difficulty_changed: boolean;
}

export interface Quiz {
  session_id: string;
  topic_slug: string;
  difficulty: Level;
  questions: Question[];
}

export interface Recommendation {
  topic_slug: string;
  topic_name: string;
  reason: string;
  message: string;
  suggested_mode: LearningMode;
  suggested_difficulty: Level;
}

export interface QuizResult {
  session_id: string;
  topic_slug: string;
  total_questions: number;
  answered: number;
  correct: number;
  accuracy: number;
  strong_areas: string[];
  needs_practice: string[];
  recommendation: Recommendation;
}

export interface CompletionRequirement {
  label: string;
  met: boolean;
  progress: string;
}

export interface TopicProgress {
  topic_slug: string;
  topic_name: string;
  questions_attempted: number;
  correct_answers: number;
  accuracy: number;
  mastery: Mastery;
  current_difficulty: Level;
  strengths: string[];
  weaknesses: string[];
  last_attempted_at: string | null;
  completion_percent: number;
  completion_status: CompletionStatus;
  completed: boolean;
  remarks: string[];
  requirements: CompletionRequirement[];
  concepts_covered: string[];
  concepts_remaining: string[];
  recent_correct: number;
  recent_answered: number;
}

export interface OverallProgress {
  questions_attempted: number;
  correct_answers: number;
  accuracy: number;
  completion_percent: number;
  topics_completed: number;
  topics: TopicProgress[];
}

export interface ConceptScore {
  concept: string;
  correct: number;
  total: number;
}

export interface QuestionReview {
  question_id: string;
  prompt: string;
  code: string | null;
  options: string[];
  question_type: QuestionType;
  concept: string;
  your_answer: string;
  correct_answer: string;
  explanation: string;
  correct: boolean;
}

export interface FinalTestResult {
  correct: number;
  total: number;
  accuracy: number;
  time_taken_seconds: number;
  finished_by: "submitted" | "time_up";
  concept_scores: ConceptScore[];
  strong_areas: string[];
  needs_practice: string[];
  remarks: string[];
  review: QuestionReview[];
}

export interface FinalTest {
  id: string;
  topic_slug: string;
  topic_name: string;
  difficulty: Level;
  questions: Question[];
  answers: Record<string, string>;
  time_limit_seconds: number;
  seconds_remaining: number;
  started_at: string;
  submitted: boolean;
  result: FinalTestResult | null;
  recommendation: Recommendation | null;
}