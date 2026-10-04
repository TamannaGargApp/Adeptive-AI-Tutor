"use client";

import { useState } from "react";

import { runCode, type RunLanguage, type RunResult } from "@/lib/codeRunner";

/** A code block from the tutor with a Run button that executes it in the browser. */
export default function RunnableCode({ code, language }: { code: string; language: RunLanguage }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setLoadError(null);
    try {
      setResult(await runCode(language, code));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The code runner couldn't start.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg bg-code">
      <div className="relative">
        <pre className="overflow-x-auto px-4 py-3 pr-20 font-mono text-sm leading-relaxed text-code-fg">
          <code>{code}</code>
        </pre>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="absolute top-2 right-2 rounded-md border border-code-fg/20 px-2.5 py-1 text-xs font-bold text-code-fg hover:bg-code-fg/10 disabled:opacity-60"
        >
          {running ? "Running…" : "▶ Run"}
        </button>
      </div>
      {(result || loadError) && (
        <div className="border-t border-code-fg/15 px-4 py-2.5 font-mono text-sm" aria-live="polite">
          <p className="mb-1 text-xs font-bold text-code-fg/60">Output</p>
          {loadError && <p className="text-bad">{loadError}</p>}
          {result?.stdout && <pre className="whitespace-pre-wrap text-code-fg">{result.stdout}</pre>}
          {result?.error && <pre className="whitespace-pre-wrap text-bad">{result.error}</pre>}
          {result && !result.stdout && !result.error && <p className="text-code-fg/60">(no output)</p>}
        </div>
      )}
    </div>
  );
}