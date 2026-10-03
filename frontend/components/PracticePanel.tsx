"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { useGamification } from "@/lib/gamification";
import { LEVEL_LABELS } from "@/lib/labels";
import type { EvaluationResult, LearningSession, Level, Question } from "@/lib/types";

import QuizQuestion from "./QuizQuestion";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

interface PracticePanelProps {
  session: LearningSession;
  onDifficultyChange: (difficulty: Level) => void;
}

export default function PracticePanel({ session, onDifficultyChange }: PracticePanelProps) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const { refresh: refreshGamification } = useGamification();

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswer("");
    try {
      setQuestion(await api.practice(session.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [session.id]);

  useEffect(() => {
    // The ref stops React's development double-render from generating two questions.
    if (loadedSessionRef.current === session.id) return;
    loadedSessionRef.current = session.id;
    setNotice(null);
    void loadQuestion();
  }, [session.id, loadQuestion]);

  async function submitAnswer() {
    if (!question) return;
    setSubmitting(true);
    setError(null);
    try {
      const evaluation = await api.evaluate(question.id, answer);
      setResult(evaluation);
      refreshGamification();
      if (evaluation.difficulty_changed) {
        onDifficultyChange(evaluation.next_difficulty);
        setNotice(
          evaluation.correct
            ? `Great streak! Your next questions will be ${LEVEL_LABELS[evaluation.next_difficulty].toLowerCase()} level.`
            : `Let's slow down a little. Your next questions will be ${LEVEL_LABELS[evaluation.next_difficulty].toLowerCase()} level.`,
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const locked = result !== null && !result.can_retry;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      {notice && <Alert kind="info">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {loading && <WaitingMessage label="Writing a question for you…" />}

      {!loading && question && (
        <div className="panel p-5 sm:p-6">
          <QuizQuestion
            question={question}
            answer={answer}
            onAnswerChange={setAnswer}
            onSubmit={submitAnswer}
            submitting={submitting}
            locked={locked}
            result={result}
          />
          {submitting && (
            <div className="mt-4">
              <WaitingMessage label="Checking your answer…" />
            </div>
          )}
        </div>
      )}

      {!loading && (locked || !question) && (
        <button type="button" className="btn btn-primary" onClick={loadQuestion}>
          {question ? "Next question" : "Try again"}
        </button>
      )}
      {!loading && question && !locked && result && (
        <button type="button" className="btn btn-secondary" onClick={loadQuestion}>
          Skip to a new question
        </button>
      )}
    </div>
  );
}