/**
 * Runs learner code in the browser, never on the server.
 *
 * - Python runs in Pyodide (CPython compiled to WebAssembly), loaded from a CDN the first time.
 * - JavaScript runs in a plain Web Worker.
 *
 * Each language has its own Web Worker, so a slow or infinite loop can be stopped by terminating the
 * worker without freezing the page. A fresh worker is created after a timeout.
 */

import type { TestCase } from "./types";

// Update this to move to a newer Pyodide release.
const PYODIDE_VERSION = "0.26.4";
const RUN_TIMEOUT_MS = 5000;
// Loading Pyodide (several MB) can take a while the first time; it's cached afterwards.
const LOAD_TIMEOUT_MS = 60_000;

export type RunLanguage = "python" | "javascript";

export interface RunResult {
  stdout: string;
  error: string | null;
  timedOut: boolean;
}

export interface TestOutcome {
  test: TestCase;
  output: string;
  error: string | null;
  passed: boolean;
}

/** Display names for the languages the browser can run (courses can use any of them). */
export const RUN_LANGUAGE_NAMES: Record<RunLanguage, string> = { python: "Python", javascript: "JavaScript" };

export function isRunnable(language: string | undefined): language is RunLanguage {
  return language === "python" || language === "javascript";
}

const PYTHON_WORKER = `
importScripts("https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js");
const ready = loadPyodide().then((pyodide) => { self.postMessage({ type: "ready" }); return pyodide; });

function lastLines(message) {
  // Pyodide tracebacks include its own internal frames; the last lines are what learners need.
  return String(message).trim().split("\\n").slice(-3).join("\\n");
}

async function run(pyodide, namespace, source) {
  let out = "";
  pyodide.setStdout({ batched: (text) => { out += text + "\\n"; } });
  pyodide.setStderr({ batched: (text) => { out += text + "\\n"; } });
  try {
    await pyodide.runPythonAsync(source, { globals: namespace });
    return { stdout: out, error: null };
  } catch (error) {
    return { stdout: out, error: lastLines(error.message || error) };
  }
}

// Packages pip-installed on first use (not bundled with Pyodide), keyed by import name.
const PIP_PACKAGES = { flask: "flask" };
const installed = new Set();

async function loadPackages(pyodide, source) {
  // Packages bundled with Pyodide (pandas, numpy, ...) are found from the imports.
  await pyodide.loadPackagesFromImports(source);
  for (const [name, pipName] of Object.entries(PIP_PACKAGES)) {
    if (installed.has(name)) continue;
    if (!new RegExp("^\\\\s*(from|import)\\\\s+" + name + "\\\\b", "m").test(source)) continue;
    await pyodide.loadPackage("micropip");
    await pyodide.pyimport("micropip").install(pipName);
    installed.add(name);
  }
}

self.onmessage = async (event) => {
  const { id, code, tests } = event.data;
  const pyodide = await ready;
  // Download any libraries the code needs before the run timer starts.
  try {
    await loadPackages(pyodide, code + "\\n" + (tests || []).map((test) => test.input || "").join("\\n"));
  } catch (error) {
    const failed = { stdout: "", error: "Couldn't load a library this code needs. Check your connection and try again." };
    self.postMessage({ type: "loaded", id });
    self.postMessage({ type: "result", id, program: failed, outputs: (tests || []).map(() => failed) });
    return;
  }
  self.postMessage({ type: "loaded", id });
  const namespace = pyodide.globals.get("dict")();
  const program = await run(pyodide, namespace, code);
  if (!tests) { self.postMessage({ type: "result", id, program }); return; }
  const outputs = [];
  for (const test of tests) {
    if (!test.input) { outputs.push(program); continue; }
    outputs.push(program.error ? { stdout: "", error: program.error } : await run(pyodide, namespace, "print(" + test.input + ")"));
  }
  self.postMessage({ type: "result", id, program, outputs });
};
`;

const JAVASCRIPT_WORKER = `
function format(value) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function run(source, check) {
  const lines = [];
  let checkLines = null;
  const log = (...values) => (checkLines ?? lines).push(values.map(format).join(" "));
  const sandboxConsole = { log, info: log, warn: log, error: log };
  // Everything printed after the learner's code ends is the test's output.
  const switchToCheck = () => { checkLines = []; };
  try {
    new Function("console", "__startCheck", source + (check ? "\\n;__startCheck();\\nconsole.log(" + check + ");" : ""))(
      sandboxConsole,
      switchToCheck,
    );
    return { program: { stdout: lines.join("\\n"), error: null }, check: { stdout: (checkLines ?? []).join("\\n"), error: null } };
  } catch (error) {
    const result = { stdout: lines.join("\\n"), error: String(error) };
    return { program: result, check: { stdout: (checkLines ?? []).join("\\n"), error: String(error) } };
  }
}

self.postMessage({ type: "ready" });
self.onmessage = (event) => {
  const { id, code, tests } = event.data;
  self.postMessage({ type: "loaded", id });
  const program = run(code, null).program;
  if (!tests) { self.postMessage({ type: "result", id, program }); return; }
  const outputs = tests.map((test) => (test.input ? run(code, test.input).check : program));
  self.postMessage({ type: "result", id, program, outputs });
};
`;

interface WorkerState {
  worker: Worker;
  ready: Promise<void>;
}

const workers: Partial<Record<RunLanguage, WorkerState>> = {};
let nextId = 0;

function getWorker(language: RunLanguage): WorkerState {
  const existing = workers[language];
  if (existing) return existing;

  const source = language === "python" ? PYTHON_WORKER : JAVASCRIPT_WORKER;
  const worker = new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Loading the code runner took too long.")), LOAD_TIMEOUT_MS);
    const onReady = (event: MessageEvent) => {
      if (event.data?.type !== "ready") return;
      clearTimeout(timer);
      worker.removeEventListener("message", onReady);
      resolve();
    };
    worker.addEventListener("message", onReady);
    worker.addEventListener("error", () => reject(new Error("The code runner failed to load. Check your connection.")));
  });
  const state = { worker, ready };
  workers[language] = state;
  return state;
}

function resetWorker(language: RunLanguage) {
  workers[language]?.worker.terminate();
  delete workers[language];
}

interface WorkerReply {
  program: { stdout: string; error: string | null };
  outputs?: { stdout: string; error: string | null }[];
}

async function execute(language: RunLanguage, code: string, tests: TestCase[] | null): Promise<WorkerReply | null> {
  const state = getWorker(language);
  try {
    await state.ready;
  } catch (error) {
    resetWorker(language);
    throw error;
  }

  const id = nextId++;
  return new Promise((resolve, reject) => {
    // First the worker downloads any libraries the code imports (pandas, flask, ...), which
    // can take a while the first time. Only once that's done does the run timer start.
    let timer = setTimeout(() => {
      state.worker.removeEventListener("message", onMessage);
      resetWorker(language);
      reject(new Error("Loading the libraries this code needs took too long. Check your connection."));
    }, LOAD_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.id !== id) return;
      if (event.data.type === "loaded") {
        clearTimeout(timer);
        timer = setTimeout(() => {
          // Probably an infinite loop: kill the worker; a fresh one is made next time.
          state.worker.removeEventListener("message", onMessage);
          resetWorker(language);
          resolve(null);
        }, RUN_TIMEOUT_MS);
        return;
      }
      if (event.data.type !== "result") return;
      clearTimeout(timer);
      state.worker.removeEventListener("message", onMessage);
      resolve(event.data as WorkerReply);
    };
    state.worker.addEventListener("message", onMessage);
    state.worker.postMessage({ id, code, tests });
  });
}

const TIMEOUT_MESSAGE = `Stopped after ${RUN_TIMEOUT_MS / 1000} seconds. Check for a loop that never ends.`;

export async function runCode(language: RunLanguage, code: string): Promise<RunResult> {
  const reply = await execute(language, code, null);
  if (!reply) return { stdout: "", error: TIMEOUT_MESSAGE, timedOut: true };
  return { stdout: reply.program.stdout.trimEnd(), error: reply.program.error, timedOut: false };
}

/** Outputs are compared ignoring whitespace, so "[1,2]" matches "[1, 2]". */
function sameOutput(actual: string, expected: string): boolean {
  return actual.replace(/\s+/g, "") === expected.replace(/\s+/g, "");
}

export async function runTests(language: RunLanguage, code: string, tests: TestCase[]): Promise<TestOutcome[]> {
  const reply = await execute(language, code, tests);
  return tests.map((test, index) => {
    if (!reply) return { test, output: "", error: TIMEOUT_MESSAGE, passed: false };
    const result = reply.outputs?.[index] ?? { stdout: "", error: "No result." };
    const output = result.stdout.trimEnd();
    return { test, output, error: result.error, passed: !result.error && sameOutput(output, test.expected_output) };
  });
}