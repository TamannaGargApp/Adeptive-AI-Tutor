import type {
  ActivityHistory,
  AdminCourse,
  AdminStats,
  AdminTopic,
  AdminUserRow,
  CourseDeletePreview,
  CourseNotesFile,
  CourseInput,
  EvaluationResult,
  FeedbackReport,
  FinalTest,
  Gamification,
  LearnReply,
  LearningMode,
  LearningSession,
  Level,
  OverallProgress,
  ProfileUpdate,
  Question,
  Quiz,
  QuizResult,
  Recommendation,
  SessionSummary,
  CourseSuggestion,
  PlanDraft,
  PlanGoal,
  PlanSettings,
  PlanStrategy,
  StudyPlan,
  StudySet,
  StudySetSummary,
  StudyTool,
  Subject,
  TestRunResult,
  TopicMaterial,
  Topic,
  TopicInput,
  TopicProgress,
  User,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Fired when an authenticated request returns 401, so the app can send the learner to login. */
export const AUTH_EXPIRED_EVENT = "auth:expired";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: "Please log in to continue.",
  404: "We couldn't find what you were looking for.",
  500: "Something went wrong on our side. Please try again.",
  503: "The AI tutor is unavailable right now. Please try again in a moment.",
  504: "The AI tutor took too long to answer. Please try again.",
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Non-JSON error body: fall through to a generic message.
  }
  return FALLBACK_MESSAGES[response.status] ?? `Request failed (${response.status}). Please try again.`;
}

// AI requests can legitimately take a while (the backend may retry or switch models), but never
// forever. The backend gives up after 55 seconds, so this limit is only a safety net.
const DEFAULT_TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 70_000;

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError("This is taking too long. Please try again.", 408);
    }
    throw new ApiError("Can't reach the server. Check that the backend is running, then try again.", 0);
  } finally {
    clearTimeout(timer);
  }

  // Auth endpoints report 401 for wrong credentials; that isn't an expired session.
  if (response.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
  // 204 No Content (e.g. after a delete) has no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Fired after the study plan changes, so the header's plan chip can refresh straight away. */
export const STUDY_PLAN_CHANGED_EVENT = "study-plan:changed";

async function planChanged<T>(pending: Promise<T>): Promise<T> {
  const result = await pending;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STUDY_PLAN_CHANGED_EVENT));
  return result;
}

/** Streak days are counted in the learner's own timezone. */
function timezoneQuery(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return new URLSearchParams({ tz: timezone }).toString();
}

function subjectQuery(subjectSlug?: string): string {
  return subjectSlug ? `?${new URLSearchParams({ subject: subjectSlug }).toString()}` : "";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<User>("/api/auth/register", { method: "POST", body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<User>("/api/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
  me: () => request<User>("/api/auth/me"),

  updateProfile: (data: ProfileUpdate) => request<User>("/api/profile", { method: "PUT", body: data }),

  getSubjects: () => request<Subject[]>("/api/subjects"),
  addSubjectToPlan: (subjectSlug: string) => request<User>(`/api/plan/subjects/${subjectSlug}`, { method: "POST" }),
  removeSubjectFromPlan: (subjectSlug: string) =>
    request<User>(`/api/plan/subjects/${subjectSlug}`, { method: "DELETE" }),
  setCurrentSubject: (subjectSlug: string) =>
    request<User>("/api/plan/current", { method: "PUT", body: { subject_slug: subjectSlug } }),

  // These default to the learner's current course when no course is given.
  getTopicMaterial: (topicSlug: string) =>
    request<TopicMaterial>(`/api/topics/${topicSlug}/material`, { timeoutMs: AI_TIMEOUT_MS }),
  getTopics: (subjectSlug?: string) => request<Topic[]>(`/api/topics${subjectQuery(subjectSlug)}`),

  createSession: (topicSlug: string, mode: LearningMode, difficulty?: Level, resume = false) =>
    request<LearningSession>("/api/sessions", {
      method: "POST",
      body: { topic_slug: topicSlug, mode, difficulty: difficulty ?? null, resume },
    }),
  getSession: (sessionId: string) => request<LearningSession>(`/api/sessions/${sessionId}`),
  listLearnSessions: (topicSlug: string) =>
    request<SessionSummary[]>(`/api/sessions?${new URLSearchParams({ topic_slug: topicSlug }).toString()}`),

  learn: (sessionId: string, message: string, attachments: { name: string; text: string; new: boolean }[] = []) =>
    request<LearnReply>("/api/tutor/learn", {
      method: "POST",
      body: { session_id: sessionId, message, attachments },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  practice: (sessionId: string) =>
    request<Question>("/api/tutor/practice", {
      method: "POST",
      body: { session_id: sessionId },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  evaluate: (questionId: string, answer: string, testResults?: TestRunResult[]) =>
    request<EvaluationResult>("/api/tutor/evaluate", {
      method: "POST",
      body: { question_id: questionId, answer, test_results: testResults ?? null },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  createQuiz: (sessionId: string) =>
    request<Quiz>("/api/tutor/quiz", { method: "POST", body: { session_id: sessionId }, timeoutMs: AI_TIMEOUT_MS }),
  getQuizResult: (sessionId: string) => request<QuizResult>(`/api/tutor/quiz/${sessionId}/result`),

  startTopicTest: (topicSlug: string) =>
    request<FinalTest>("/api/final-tests", { method: "POST", body: { topic_slug: topicSlug }, timeoutMs: AI_TIMEOUT_MS }),
  startCourseExam: (subjectSlug: string) =>
    request<FinalTest>("/api/final-tests", {
      method: "POST",
      body: { subject_slug: subjectSlug },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  getFinalTest: (testId: string) => request<FinalTest>(`/api/final-tests/${testId}`),
  saveFinalTestAnswer: (testId: string, questionId: string, answer: string) =>
    request<{ message: string }>(`/api/final-tests/${testId}/answers`, {
      method: "PUT",
      body: { question_id: questionId, answer },
    }),
  updateFinalTestStatus: (testId: string, questionId: string, status: { flagged?: boolean; visited?: boolean }) =>
    request<{ message: string }>(`/api/final-tests/${testId}/status`, {
      method: "PUT",
      body: { question_id: questionId, ...status },
    }),
  submitFinalTest: (testId: string, answers: Record<string, string>) =>
    request<FinalTest>(`/api/final-tests/${testId}/submit`, { method: "POST", body: { answers } }),

  getGamification: () => request<Gamification>(`/api/gamification?${timezoneQuery()}`),
  getActivity: (days = 30) => request<ActivityHistory>(`/api/activity?${timezoneQuery()}&days=${days}`),

  getFeedback: () => request<FeedbackReport | null>("/api/feedback"),
  createFeedback: () => request<FeedbackReport>("/api/feedback", { method: "POST", timeoutMs: AI_TIMEOUT_MS }),

  admin: {
    stats: () => request<AdminStats>("/api/admin/stats"),
    users: () => request<AdminUserRow[]>("/api/admin/users"),
    courses: () => request<AdminCourse[]>("/api/admin/courses"),
    createCourse: (data: CourseInput) => request<AdminCourse>("/api/admin/courses", { method: "POST", body: data }),
    updateCourse: (slug: string, data: CourseInput) =>
      request<AdminCourse>(`/api/admin/courses/${slug}`, { method: "PUT", body: data }),
    deletePreview: (slug: string) => request<CourseDeletePreview>(`/api/admin/courses/${slug}/delete-preview`),
    deleteCourse: (slug: string) => request<void>(`/api/admin/courses/${slug}`, { method: "DELETE" }),
    updateMaterial: (topicSlug: string, content: string, keyTakeaways: string[]) =>
      request<TopicMaterial>(`/api/admin/topics/${topicSlug}/material`, {
        method: "PUT",
        body: { content, key_takeaways: keyTakeaways },
      }),
    regenerateMaterial: (topicSlug: string) =>
      request<TopicMaterial>(`/api/admin/topics/${topicSlug}/material/regenerate`, {
        method: "POST",
        timeoutMs: AI_TIMEOUT_MS,
      }),
    listNotes: (topicSlug: string) => request<CourseNotesFile[]>(`/api/admin/topics/${topicSlug}/notes`),
    uploadNotes: (topicSlug: string, fileName: string, text: string) =>
      request<CourseNotesFile>(`/api/admin/topics/${topicSlug}/notes`, {
        method: "POST",
        body: { file_name: fileName, text },
      }),
    deleteNotes: (notesId: string) => request<void>(`/api/admin/notes/${notesId}`, { method: "DELETE" }),
    topics: (courseSlug: string) => request<AdminTopic[]>(`/api/admin/courses/${courseSlug}/topics`),
    createTopic: (courseSlug: string, data: TopicInput) =>
      request<AdminTopic>("/api/admin/topics", { method: "POST", body: { ...data, subject_slug: courseSlug } }),
    updateTopic: (slug: string, data: TopicInput) =>
      request<AdminTopic>(`/api/admin/topics/${slug}`, { method: "PUT", body: data }),
    moveTopic: (slug: string, direction: "up" | "down") =>
      request<AdminTopic[]>(`/api/admin/topics/${slug}/move`, { method: "POST", body: { direction } }),
  },

  // The learner's goal-based study plan (one per learner, across courses).
  getStudyPlan: () => request<StudyPlan | null>(`/api/study-plan?${timezoneQuery()}`),
  suggestPlanCourses: (goal: PlanGoal) =>
    request<CourseSuggestion>("/api/study-plan/suggest-courses", { method: "POST", body: goal, timeoutMs: AI_TIMEOUT_MS }),
  draftStudyPlan: (draft: {
    goal: string;
    level: Level;
    courses: string[];
    settings: PlanSettings;
    strategy?: PlanStrategy | null;
    change_request?: string | null;
  }) =>
    request<PlanDraft>(`/api/study-plan/draft?${timezoneQuery()}`, { method: "POST", body: draft, timeoutMs: AI_TIMEOUT_MS }),
  acceptStudyPlan: (draft: PlanDraft) =>
    planChanged(
      request<StudyPlan>(`/api/study-plan/accept?${timezoneQuery()}`, {
        method: "POST",
        body: { goal: draft.goal, level: draft.level, courses: draft.courses, settings: draft.settings, strategy: draft.strategy },
      }),
    ),
  replanStudyPlan: () => planChanged(request<StudyPlan>(`/api/study-plan/replan?${timezoneQuery()}`, { method: "POST" })),
  setPlanTaskDone: (taskId: string, done: boolean) =>
    planChanged(
      request<StudyPlan>(`/api/study-plan/tasks/${taskId}?${timezoneQuery()}`, { method: "PATCH", body: { done } }),
    ),
  deleteStudyPlan: () => planChanged(request<void>("/api/study-plan", { method: "DELETE" })),

  studySets: {
    list: () => request<StudySetSummary[]>("/api/study-sets"),
    create: (data: { title: string; file_name: string; content_type: string; text: string; file_base64: string | null }) =>
      request<StudySetSummary>("/api/study-sets", { method: "POST", body: data, timeoutMs: AI_TIMEOUT_MS }),
    get: (id: string) => request<StudySet>(`/api/study-sets/${id}`),
    remove: (id: string) => request<void>(`/api/study-sets/${id}`, { method: "DELETE" }),
    generate: (id: string, tool: StudyTool, regenerate = false) =>
      request<StudySet>(`/api/study-sets/${id}/tools/${tool}${regenerate ? "?regenerate=true" : ""}`, {
        method: "POST",
        timeoutMs: AI_TIMEOUT_MS,
      }),
    /** New cards that don't repeat the deck; returns the updated set and the new cards' ids. */
    moreFlashcards: (id: string) =>
      request<{ study_set: StudySet; new_card_ids: string[] }>(`/api/study-sets/${id}/flashcards/more`, {
        method: "POST",
        timeoutMs: AI_TIMEOUT_MS,
      }),
    saveFlashcardProgress: (id: string, knownCardIds: string[]) =>
      request<StudySet>(`/api/study-sets/${id}/flashcards/progress`, {
        method: "PUT",
        body: { known_card_ids: knownCardIds },
      }),
    saveQuizResult: (id: string, score: number, total: number) =>
      request<StudySet>(`/api/study-sets/${id}/quiz-result`, { method: "POST", body: { score, total } }),
    chat: (id: string, message: string) =>
      request<{ reply: StudySet["chat"][number] }>(`/api/study-sets/${id}/chat`, {
        method: "POST",
        body: { message },
        timeoutMs: AI_TIMEOUT_MS,
      }),
    /** Opens in a new tab; the browser sends the login cookie. */
    downloadUrl: (id: string) => `${API_URL}/api/study-sets/${id}/download`,
  },

  getProgress: (subjectSlug?: string) => request<OverallProgress>(`/api/progress${subjectQuery(subjectSlug)}`),
  getTopicProgress: (topicSlug: string) => request<TopicProgress>(`/api/progress/${topicSlug}`),
  getRecommendation: (subjectSlug?: string) =>
    request<Recommendation>(`/api/recommendations${subjectQuery(subjectSlug)}`),
};