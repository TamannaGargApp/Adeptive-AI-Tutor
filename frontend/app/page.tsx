"use client";

import Link from "next/link";

import { DemoVideo, Screenshot } from "@/components/LandingMedia";
import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

const STEPS = [
  { title: "Set a goal", text: "Tell us what you want to achieve, or simply pick a course." },
  { title: "Get a plan", text: "A day-by-day schedule built around your time and what you already know." },
  { title: "Learn", text: "Read clear notes, then ask the AI tutor anything, by text or voice." },
  { title: "Practise", text: "Questions and coding exercises with hints, adapting to your level." },
  { title: "Prove it", text: "Pass timed tests to complete topics and courses, and see your progress." },
];

const STUDY_SET_TOOLS = [
  { icon: "📝", title: "AI Notes", text: "Structured notes that write themselves, so you focus on understanding." },
  { icon: "📄", title: "AI Summary", text: "The key points and terms at a glance. Perfect before a test." },
  { icon: "🗂️", title: "AI Flashcards", text: "Active recall that remembers which cards you still need to review." },
  { icon: "❓", title: "AI Quizzes", text: "Test yourself with explained answers and spot gaps early." },
  { icon: "💬", title: "AI Tutor", text: "Ask questions about your own material, any time." },
];

interface Feature {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  screenshot: { file: string; alt: string; label: string };
}

const FEATURES: Feature[] = [
  {
    eyebrow: "Courses",
    title: "A tutor that teaches, not just answers",
    text: "Python and JavaScript courses where every topic has four ways to learn, each adapting to your level.",
    points: [
      "Read: study notes for every topic, with examples you can run",
      "Learn: chat with the tutor, which explains rather than hands you answers",
      "Practice: one question at a time, with hints when you're stuck",
      "Quiz: a quick check with a score and what to review next",
    ],
    screenshot: { file: "learn-chat.png", alt: "The AI tutor explaining a Python loop with a runnable example", label: "Learn chat" },
  },
  {
    eyebrow: "Study plans",
    title: "A personalized plan for your goal",
    text: "Describe your goal and the planner suggests courses, works out the timing and builds a schedule you can adjust in plain words.",
    points: [
      "Several courses at once, in the right order and balance",
      "Fits the days and minutes you actually have",
      "Tasks tick themselves as you study; replan any time",
    ],
    screenshot: { file: "study-plan.png", alt: "A study plan with today's tasks and a timeline", label: "Study plan" },
  },
  {
    eyebrow: "Real coding",
    title: "Write and run code in your browser",
    text: "No setup. Run any example from your tutor or notes, and solve coding exercises checked against tests.",
    points: ["Python and JavaScript run right in the page", "Tests show exactly what passed and why", "Feedback on your code, not just the result"],
    screenshot: { file: "code-exercise.png", alt: "A coding exercise with all its tests passing", label: "Coding exercise" },
  },
  {
    eyebrow: "Tests",
    title: "Prove what you know",
    text: "Each topic ends with a timed final test, and each course with an exam. Pass them to complete topics and courses.",
    points: [
      "Timed tests with review marks and autosave",
      "A detailed analysis: score, topics and every answer explained",
      "Clear rules: what you need to pass and when you can retry",
    ],
    screenshot: { file: "final-test.png", alt: "Final test results with a per-topic breakdown", label: "Test results" },
  },
  {
    eyebrow: "Progress",
    title: "Stay motivated",
    text: "See your progress grow and keep your momentum with streaks, levels and badges.",
    points: ["Daily streaks and XP levels", "Badges for real milestones", "Charts of your activity and accuracy", "Personalized feedback from your AI coach"],
    screenshot: { file: "achievements.png", alt: "The achievements page with a streak calendar and badges", label: "Achievements" },
  },
];

const EXTRAS = [
  { icon: "🎙️", title: "Voice tutoring", text: "Talk to the tutor hands-free and hear its answers." },
  { icon: "📎", title: "Attach your files", text: "Ask the tutor about a PDF or code file in the chat." },
  { icon: "🌗", title: "Light & dark", text: "Easy on the eyes, day or night." },
  { icon: "🎯", title: "Adaptive difficulty", text: "Questions get harder or easier as you improve." },
];

const FAQS = [
  {
    question: "What can I learn here?",
    answer:
      "Python and JavaScript, from the very basics, through structured courses. With study sets you can also study any subject from your own notes.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No. Everything runs in your browser, including the code you write.",
  },
  {
    question: "What happens to the files I upload?",
    answer:
      "Study set files are stored privately for your account, and you can delete them at any time. Files you attach in a tutor chat stay in your browser and aren't saved on our servers.",
  },
  {
    question: "Which AI powers the tutor?",
    answer: "Google Gemini, guided to teach step by step: hints before answers, and explanations pitched at your level.",
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const primaryCta = user ? { href: "/dashboard", label: "Go to dashboard" } : { href: "/register", label: "Get Started" };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center">
            <LogoMark height={44} />
          </span>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-bold text-ink-soft md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#study-sets" className="hover:text-ink">Study sets</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!loading && !user && (
              <>
                <Link href="/login" className="font-bold text-blue hover:text-blue-deep">
                  Login
                </Link>
                <Link href="/register" className="btn btn-primary px-4 py-2 text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-24 -left-32 h-96 w-96 rounded-full bg-blue-tint blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-sun-tint blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/20 bg-blue-tint px-3 py-1 text-xs font-bold text-blue-deep">
                Powered by Gemini
              </span>
              <h1 className="mt-4 text-4xl leading-[1.1] font-bold tracking-tight sm:text-6xl">Adaptive AI Tutor</h1>
              <p className="mt-5 max-w-xl text-lg text-ink-soft sm:text-xl">
                Your personal AI tutor for learning to code, and a study system for everything else. Learn Python and
                JavaScript step by step, or turn your own notes into summaries, flashcards and quizzes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={primaryCta.href} className="btn btn-primary px-6 py-3 text-lg">
                  {primaryCta.label}
                </Link>
                {!user && (
                  <Link href="/login" className="btn btn-secondary px-6 py-3 text-lg">
                    Login
                  </Link>
                )}
              </div>
              <p className="mt-4 text-sm text-ink-soft">Free to start · No credit card required</p>
            </div>

          {/* The hero shows the product's core behaviour: a wrong answer meets a hint, not the solution.
              It uses the code-block colours, which stay dark in both light and dark themes. */}
          <section
            aria-label="Example of the tutor giving a hint"
            className="overflow-hidden rounded-2xl bg-code shadow-xl shadow-black/15 ring-1 ring-line"
          >
            <div className="flex items-center gap-1.5 border-b border-code-fg/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-sun/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
            </div>
            <div className="space-y-4 p-5 font-mono text-sm sm:p-6">
              <p className="text-code-fg/60"># What will this print?</p>
              <pre className="text-code-fg">
                <span className="text-sun">for</span> i <span className="text-sun">in</span> range(3):{"\n"}
                {"    "}print(i)
              </pre>
              <div className="rounded-lg border border-code-fg/15 px-4 py-3">
                <p className="text-code-fg/60">Your answer</p>
                <p className="text-code-fg">1 2 3</p>
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
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
              <p className="mt-2 text-ink-soft">From &quot;I want to learn this&quot; to &quot;I can prove it&quot;, with the AI guiding every step.</p>
            </div>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="panel p-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-blue text-sm font-bold text-on-accent">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{step.text}</p>
                </li>
              ))}
            </ol>
            <DemoVideo />
          </div>
        </section>

        {/* ---------- Study sets ---------- */}
        <section id="study-sets" className="relative scroll-mt-20 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute top-10 -left-24 h-80 w-80 rounded-full bg-sun-tint blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-16">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm font-bold text-blue-deep">Study sets</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Turn your notes into a study system</h2>
                <p className="mt-3 text-ink-soft">
                  Upload your lecture notes, a handout or a textbook chapter, on any subject, and get everything you need
                  to understand it and remember it.
                </p>
              </div>
              <Screenshot file="study-set.png" alt="A study set showing flashcards made from a learner's notes" label="Study set" />
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STUDY_SET_TOOLS.map((tool) => (
                <li key={tool.title} className="panel p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-tint text-2xl" aria-hidden>
                    {tool.icon}
                  </span>
                  <h3 className="mt-3 font-bold">{tool.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{tool.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl space-y-20 px-4 py-16">
            {FEATURES.map((feature, index) => (
              <div key={feature.title} className="grid items-center gap-10 lg:grid-cols-2">
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <p className="text-sm font-bold text-blue-deep">{feature.eyebrow}</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{feature.title}</h2>
                  <p className="mt-3 text-ink-soft">{feature.text}</p>
                  <ul className="mt-4 space-y-2">
                    {feature.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="font-bold text-good" aria-hidden>✓</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <Screenshot {...feature.screenshot} />
              </div>
            ))}

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EXTRAS.map((extra) => (
                <li key={extra.title} className="panel p-5">
                  <span className="text-2xl" aria-hidden>{extra.icon}</span>
                  <h3 className="mt-2 font-bold">{extra.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{extra.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Questions</h2>
            <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                    {faq.question}
                    <span className="text-ink-soft transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-2 text-ink-soft">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Final call to action ---------- */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Start learning today</h2>
            <p className="mt-2 text-ink-soft">Set a goal, follow your plan, and see your progress every day.</p>
            <Link href={primaryCta.href} className="btn btn-primary mt-6 px-6 py-3 text-lg">
              {primaryCta.label}
            </Link>
          </div>
        </section>
      </main>

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