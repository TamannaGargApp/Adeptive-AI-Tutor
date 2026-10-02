import type {
  EvaluationResult,
  FinalTest,
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
  Topic,
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
// forever. The backend gives up after 45 seconds, so this limit is only a safety net.
const DEFAULT_TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 60_000;

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
  return (await response.json()) as T;
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

  getTopics: () => request<Topic[]>("/api/topics"),

  createSession: (topicSlug: string, mode: LearningMode, difficulty?: Level, resume = false) =>
    request<LearningSession>("/api/sessions", {
      method: "POST",
      body: { topic_slug: topicSlug, mode, difficulty: difficulty ?? null, resume },
    }),
  getSession: (sessionId: string) => request<LearningSession>(`/api/sessions/${sessionId}`),

  learn: (sessionId: string, message: string) =>
    request<LearnReply>("/api/tutor/learn", {
      method: "POST",
      body: { session_id: sessionId, message },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  practice: (sessionId: string) =>
    request<Question>("/api/tutor/practice", {
      method: "POST",
      body: { session_id: sessionId },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  evaluate: (questionId: string, answer: string) =>
    request<EvaluationResult>("/api/tutor/evaluate", {
      method: "POST",
      body: { question_id: questionId, answer },
      timeoutMs: AI_TIMEOUT_MS,
    }),
  createQuiz: (sessionId: string) =>
    request<Quiz>("/api/tutor/quiz", { method: "POST", body: { session_id: sessionId }, timeoutMs: AI_TIMEOUT_MS }),
  getQuizResult: (sessionId: string) => request<QuizResult>(`/api/tutor/quiz/${sessionId}/result`),

  startFinalTest: (topicSlug: string) =>
    request<FinalTest>("/api/final-tests", { method: "POST", body: { topic_slug: topicSlug }, timeoutMs: AI_TIMEOUT_MS }),
  getFinalTest: (testId: string) => request<FinalTest>(`/api/final-tests/${testId}`),
  saveFinalTestAnswer: (testId: string, questionId: string, answer: string) =>
    request<{ message: string }>(`/api/final-tests/${testId}/answers`, {
      method: "PUT",
      body: { question_id: questionId, answer },
    }),
  submitFinalTest: (testId: string, answers: Record<string, string>) =>
    request<FinalTest>(`/api/final-tests/${testId}/submit`, { method: "POST", body: { answers } }),

  getProgress: () => request<OverallProgress>("/api/progress"),
  getTopicProgress: (topicSlug: string) => request<TopicProgress>(`/api/progress/${topicSlug}`),
  getRecommendation: () => request<Recommendation>("/api/recommendations"),
};