export type Level = "beginner" | "intermediate" | "advanced";
export type LearningGoal = "learn_python" | "improve_problem_solving" | "interview_preparation";
export type LearningMode = "learn" | "practice" | "quiz";
/** Ways to study a topic in the tutor: reading notes, plus the three learning modes. */
export type StudyMode = "read" | LearningMode;
export type QuestionType = "multiple_choice" | "predict_output" | "short_answer" | "write_code";
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
  /** Course slugs in the learner's plan, and the course currently shown across the app. */
  subjects: string[];
  current_subject: string;
  is_admin: boolean;
  created_at: string;
}

export interface Subject {
  slug: string;
  name: string;
  description: string;
  language: string;
  topic_count: number;
  in_plan: boolean;
  current: boolean;
}

export interface ProfileUpdate {
  name: string;
  level: Level;
  goal: LearningGoal;
  preferred_difficulty: Level;
  /** Onboarding only: the first course in the plan. */
  subject_slug?: string;
}

export interface Topic {
  slug: string;
  name: string;
  description: string;
  key_concepts: string[];
  order: number;
  subject: string;
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

export interface SessionSummary {
  id: string;
  difficulty: Level;
  message_count: number;
  preview: string;
  created_at: string;
  updated_at: string;
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
  /** Coding exercises only. */
  starter_code: string | null;
  test_cases: TestCase[];
  /** Language the exercise runs in, e.g. "python" or "javascript". */
  language: string;
}

export interface TestCase {
  /** Expression whose printed value is checked, or "" to check the program's own output. */
  input: string;
  expected_output: string;
}

export interface TestRunResult {
  passed: boolean;
  output: string;
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

/** A learning mode, or one of the two kinds of timed test. */
export type RecommendedMode = LearningMode | "final_test" | "course_exam";

export interface Recommendation {
  subject_slug: string;
  /** Empty when the recommendation is the course exam. */
  topic_slug: string;
  topic_name: string;
  reason: string;
  message: string;
  suggested_mode: RecommendedMode;
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
  final_test_passed: boolean;
  final_test_best: number | null;
  /** Every requirement except the final test is met. */
  ready_for_final_test: boolean;
  /** New attempts left after passing the final test; null until it's passed (no limit before). */
  final_test_attempts_left: number | null;
  /** Failed attempts in a row before the first pass; 3 in a row lock the test for 12 hours. */
  final_test_fails_in_row: number;
  /** When a locked test opens again (ISO time), or null if it isn't locked. */
  final_test_locked_until: string | null;
}

export interface OverallProgress {
  subject_slug: string;
  subject_name: string;
  questions_attempted: number;
  correct_answers: number;
  accuracy: number;
  completion_percent: number;
  topics_completed: number;
  /** Complete = every topic complete and the course exam passed. */
  course_completed: boolean;
  course_exam_unlocked: boolean;
  course_exam_passed: boolean;
  course_exam_best: number | null;
  /** When the course exam can be retaken after a failed attempt, or null. */
  course_exam_locked_until: string | null;
  topics_remaining: string[];
  course_remarks: string[];
  topics: TopicProgress[];
}

export interface ConceptScore {
  concept: string;
  correct: number;
  total: number;
}

export interface TopicScore {
  topic_slug: string;
  topic_name: string;
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
  /** Course exams only. */
  topic_name: string | null;
}

export interface FinalTestResult {
  correct: number;
  total: number;
  accuracy: number;
  time_taken_seconds: number;
  finished_by: "submitted" | "time_up";
  concept_scores: ConceptScore[];
  /** Course exams only. */
  topic_scores: TopicScore[];
  strong_areas: string[];
  needs_practice: string[];
  remarks: string[];
  review: QuestionReview[];
  passed: boolean;
  pass_mark: number;
  /** After a fail: when the test can be taken again, if a cooldown started. */
  retry_available_at: string | null;
  /** Failed topic test attempts in a row so far (before the first pass). */
  fails_in_row: number;
}

export interface FinalTest {
  id: string;
  /** "topic" for a topic test, "course" for a course exam. */
  scope: "topic" | "course";
  title: string;
  subject_slug: string;
  topic_slug: string | null;
  difficulty: Level;
  questions: Question[];
  answers: Record<string, string>;
  flagged: string[];
  visited: string[];
  time_limit_seconds: number;
  seconds_remaining: number;
  started_at: string;
  submitted: boolean;
  result: FinalTestResult | null;
  recommendation: Recommendation | null;
}

export interface StreakDay {
  date: string;
  active: boolean;
}

export interface Streak {
  current: number;
  longest: number;
  active_today: boolean;
  recent_days: StreakDay[];
}

export interface XpLevel {
  level: number;
  total_xp: number;
  xp_into_level: number;
  xp_for_next_level: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at: string | null;
  progress: number;
  target: number;
}

export interface Gamification {
  streak: Streak;
  level: XpLevel;
  badges: Badge[];
  newly_earned: string[];
}

export interface ActivityDay {
  date: string;
  questions: number;
  correct: number;
  accuracy: number | null;
  learn_messages: number;
  xp: number;
}

export interface ActivityHistory {
  timezone: string;
  days: ActivityDay[];
}

export interface FeedbackArea {
  area: string;
  why: string;
  how: string;
}

export interface FeedbackReport {
  subject_slug: string;
  report: {
    summary: string;
    strengths: string[];
    areas_to_improve: FeedbackArea[];
    mistake_patterns: string[];
    next_steps: string[];
    encouragement: string;
  };
  created_at: string;
  based_on_answers: number;
  /** New answers exist since this report, so refreshing would add something. */
  can_refresh: boolean;
}

export interface AdminStats {
  users: number;
  active_last_7_days: number;
  questions_answered: number;
  tests_submitted: number;
  courses: { slug: string; name: string; archived: boolean; topics: number; learners: number }[];
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  subjects: string[];
  questions_answered: number;
  last_active: string | null;
  created_at: string;
}

export interface AdminCourse {
  slug: string;
  name: string;
  description: string;
  language: string;
  archived: boolean;
  order: number;
}

export interface AdminTopic {
  slug: string;
  subject: string;
  name: string;
  description: string;
  key_concepts: string[];
  order: number;
  archived: boolean;
}

export interface CourseInput {
  name: string;
  description: string;
  language: string;
  archived: boolean;
}

export interface TopicInput {
  name: string;
  description: string;
  key_concepts: string[];
  archived: boolean;
}

export interface TopicMaterial {
  topic_slug: string;
  topic_name: string;
  content: string;
  key_takeaways: string[];
  updated_at: string;
  edited: boolean;
}

export interface CourseDeletePreview {
  slug: string;
  name: string;
  topics: number;
  learners: number;
  answers: number;
  can_delete: boolean;
  reason: string | null;
}