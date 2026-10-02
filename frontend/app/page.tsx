"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";

const MODES = [
  {
    name: "Learn",
    text: "Explanations pitched at your level, with an example and a quick check after each idea.",
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    ),
  },
  {
    name: "Practice",
    text: "One question at a time. Get a hint when you're stuck instead of the answer.",
    icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  },
  {
    name: "Quiz",
    text: "Five questions, a score, and a clear note on what to review next.",
    icon: <path d="m5 13 4 4L19 7" />,
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center">
            <LogoMark height={44} />
          </span>
          {!loading && !user && (
            <div className="flex items-center gap-3">
              <Link href="/login" className="font-bold text-blue hover:text-blue-deep">
                Login
              </Link>
              <Link href="/register" className="btn btn-primary px-4 py-2 text-sm">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-blue-tint blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-sun-tint blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <section>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/20 bg-blue-tint px-3 py-1 text-xs font-bold text-blue-deep">
              Powered by Gemini
            </span>
            <h1 className="mt-4 text-4xl leading-[1.1] font-bold tracking-tight sm:text-6xl">Adaptive AI Tutor</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft sm:text-xl">
              Learn Python through personalized explanations, practice, quizzes, and intelligent feedback.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link href="/dashboard" className="btn btn-primary px-6 py-3 text-lg">
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link href="/register" className="btn btn-primary px-6 py-3 text-lg">
                    Get Started
                  </Link>
                  <Link href="/login" className="btn btn-secondary px-6 py-3 text-lg">
                    Login
                  </Link>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-ink-soft">Free to start · No credit card required</p>
          </section>

          {/* The hero shows the product's core behaviour: a wrong answer meets a hint, not the solution. */}
          <section
            aria-label="Example of the tutor giving a hint"
            className="overflow-hidden rounded-2xl bg-ink shadow-xl shadow-ink/10 ring-1 ring-ink/5"
          >
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-sun/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
            </div>
            <div className="space-y-4 p-5 font-mono text-sm sm:p-6">
              <p className="text-white/60"># What will this print?</p>
              <pre className="text-white">
                <span className="text-sun">for</span> i <span className="text-sun">in</span> range(3):{"\n"}
                {"    "}print(i)
              </pre>
              <div className="rounded-lg border border-white/15 px-4 py-3">
                <p className="text-white/60">Your answer</p>
                <p className="text-white">1 2 3</p>
              </div>
            </div>
            <div className="border-t-4 border-sun bg-sun-tint px-5 py-4 sm:px-6">
              <p className="text-sm font-bold">Hint</p>
              <p className="mt-1">
                Close! Think about where <code className="font-mono text-blue-deep">range(3)</code> starts counting. What
                is the very first number it gives you?
              </p>
            </div>
          </section>
        </div>
      </main>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three ways to study</h2>
            <p className="mt-2 text-ink-soft">Switch modes any time — the tutor adapts to how you want to learn.</p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {MODES.map((mode) => (
              <div
                key={mode.name}
                className="panel p-5 transition-shadow hover:shadow-md hover:shadow-ink/5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-tint text-blue-deep" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {mode.icon}
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-bold">{mode.name}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{mode.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-ink-soft">
          <span className="flex items-center gap-2">
            <LogoMark height={24} />
            Adaptive AI Tutor
          </span>
          <span>&copy; {new Date().getFullYear()} Adaptive AI Tutor.</span>
        </div>
      </footer>
    </div>
  );
}
