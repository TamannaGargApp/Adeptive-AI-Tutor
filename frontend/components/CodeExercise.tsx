"use client";

import { useState } from "react";

import { isRunnable, RUN_LANGUAGE_NAMES, runTests, type TestOutcome } from "@/lib/codeRunner";
import type { Question, TestRunResult } from "@/lib/types";

import CodeEditor from "./CodeEditor";
import { Alert } from "./ui";

interface CodeExerciseProps {
  question: Question;
  code: string;
  onCodeChange: (code: string) => void;
  onSubmit: (results: TestRunResult[]) => void;
  submitting: boolean;
  locked: boolean;
}

/** A write-code exercise: edit, run the tests in the browser, then submit the code with its results. */
export default function CodeExercise({ question, code, onCodeChange, onSubmit, submitting, locked }: CodeExerciseProps) {
  const [outcomes, setOutcomes] = useState<TestOutcome[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const language = isRunnable(question.language) ? question.language : "python";

  async function run(): Promise<TestOutcome[] | null> {
    setRunning(true);
    setError(null);
    try {
      const results = await runTests(language, code, question.test_cases);
      setOutcomes(results);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code runner couldn't start.");
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    const results = await run();
    if (results) onSubmit(results.map((outcome) => ({ passed: outcome.passed, output: outcome.error ?? outcome.output })));
  }

  const passedCount = outcomes?.filter((outcome) => outcome.passed).length ?? 0;
  const busy = running || submitting;

  return (
    <div className="space-y-4">
      <CodeEditor
        id={`code-${question.id}`}
        label={`Your ${RUN_LANGUAGE_NAMES[language]} code`}
        value={code}
        onChange={onCodeChange}
        disabled={locked || submitting}
      />

      <div>
        <p className="mb-1.5 text-sm font-bold">
          Tests{outcomes ? ` · ${passedCount} of ${outcomes.length} passed` : ""}
        </p>
        <ul className="space-y-1.5">
          {question.test_cases.map((test, index) => {
            const outcome = outcomes?.[index];
            return (
              <li
                key={`${test.input}-${index}`}
                className={`rounded-lg border px-3 py-2 font-mono text-sm ${
                  !outcome ? "border-line" : outcome.passed ? "border-good/40 bg-good-tint" : "border-bad/40 bg-bad-tint"
                }`}
              >
                <span className="font-bold">{outcome ? (outcome.passed ? "✓ " : "✗ ") : ""}</span>
                {test.input || "Program output"} → <span className="text-ink-soft">expected</span> {test.expected_output}
                {outcome && !outcome.passed && (
                  <span className="mt-1 block whitespace-pre-wrap text-bad">
                    {outcome.error ? outcome.error : `got ${outcome.output || "(nothing)"}`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && <Alert>{error}</Alert>}

      {!locked && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={run} disabled={busy || !code.trim()}>
            {running && !submitting ? "Running…" : "▶ Run tests"}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !code.trim()}>
            {submitting ? "Checking…" : "Submit code"}
          </button>
        </div>
      )}
      <p className="text-xs text-ink-soft">
        Code runs in your browser. The first run can take a few seconds while the language and any libraries it uses load.
      </p>
    </div>
  );
}