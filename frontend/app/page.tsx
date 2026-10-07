"use client";

import Link from "next/link";

import { DemoVideo, Screenshot } from "@/components/LandingMedia";
import { HeroCollage, Icon, type IconName, StudySetShowcase, TILE_TONES } from "@/components/LandingGraphics";
import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

const PROBLEMS: { icon: IconName; title: string; text: string }[] = [
  { icon: "notes", title: "Notes pile up", text: "Pages of notes, but no time to turn them into something you can revise from." },
  { icon: "code", title: "Answers, not understanding", text: "Tutorials hand you the solution, so nothing sticks when you try it yourself." },
  { icon: "calendar", title: "No clear plan", text: "Without a schedule, it's hard to know what to study today, or if you're on track." },
  { icon: "target", title: "Gaps you can't see", text: "You don't know what you don't know until the test, when it's too late." },
];

const FILE_TYPES = [
  { label: "PDF", note: "Lecture notes, chapters" },
  { label: "TXT", note: "Plain text notes" },
  { label: "MD", note: "Markdown notes" },
  { label: "PY", note: "Python files, in chat" },
  { label: "JS", note: "JavaScript files, in chat" },
];

const STEPS = [
  { title: "Set a goal", text: "Tell us what you want to achieve, or simply pick a course." },
  { title: "Get a plan", text: "A day-by-day schedule built around your time and what you already know." },
  { title: "Learn", text: "Read clear notes, then ask the AI tutor anything, by text or voice." },
  { title: "Practise", text: "Questions and coding exercises with hints, adapting to your level." },
  { title: "Prove it", text: "Pass timed tests to complete topics and courses." },
];

interface Feature {
  icon: IconName;
  eyebrow: string;
  title: string;
  text: string;
  chips: string[];
  /** A small "live" label floating over the screenshot. */
  badge: { text: string; tone: string };
  /** Grid placement in the bento layout. */
  span: string;
  /** Colour of the card's corner glow (a theme colour variable). */
  glow: string;
  screenshot: { file: string; alt: string; label: string; focus?: string };
}

const FEATURES: Feature[] = [
  {
    icon: "book",
    eyebrow: "Courses",
    title: "A tutor that teaches, not just answers",
    text: "Python and JavaScript courses where every topic has four ways to learn, each adapting to your level.",
    chips: ["Read", "Learn", "Practice", "Quiz"],
    badge: { text: "▶ Run  ·  0 1 2", tone: "bg-code text-code-fg" },
    span: "sm:col-span-2 lg:col-span-4",
    glow: "--color-blue",
    screenshot: { file: "learn-chat.png", alt: "The AI tutor explaining a Python concept with a runnable example", label: "Learn chat" },
  },
  {
    icon: "calendar",
    eyebrow: "Study plans",
    title: "A plan built for your goal",
    text: "Tell it your goal and time; get a day-by-day schedule across courses.",
    chips: ["Several courses", "Auto-ticking tasks", "Replan any time"],
    badge: { text: "On track ✓", tone: "bg-good-tint text-good" },
    span: "lg:col-span-2",
    glow: "--color-violet",
    screenshot: { focus: "left top", file: "study-plan.png", alt: "A study plan with progress toward the goal and today's tasks", label: "Study plan" },
  },
  {
    icon: "code",
    eyebrow: "Real coding",
    title: "Run code in your browser",
    text: "No setup. Run examples and get instant, explained feedback on every answer.",
    chips: ["Python", "JavaScript", "Tested exercises"],
    badge: { text: "✓ Correct", tone: "bg-good-tint text-good" },
    span: "lg:col-span-2",
    glow: "--color-cyan",
    screenshot: { focus: "75% top", file: "code-exercise.png", alt: "A practice question answered correctly with an explanation", label: "Practice" },
  },
  {
    icon: "target",
    eyebrow: "Tests",
    title: "Prove what you know",
    text: "Timed topic tests and course exams, with an analysis of every concept.",
    chips: ["Timed", "Autosave", "By-concept analysis"],
    badge: { text: "Passed · 90%", tone: "bg-brand" },
    span: "lg:col-span-2",
    glow: "--color-magenta",
    screenshot: { file: "final-test.png", alt: "Final test analysis with a score and a breakdown by concept", label: "Test results" },
  },
  {
    icon: "trophy",
    eyebrow: "Progress",
    title: "Stay motivated",
    text: "Streaks, XP levels, badges and feedback from your AI coach.",
    chips: ["Streaks", "Levels", "Badges"],
    badge: { text: "🔥 7-day streak", tone: "bg-sun-tint text-ink" },
    span: "sm:col-span-2 lg:col-span-2",
    glow: "--color-sun",
    screenshot: { file: "achievements.png", alt: "Achievements with a streak calendar, level and badges", label: "Achievements" },
  },
];

const COMPARISON = [
  { old: "Re-reading pages of notes", now: "AI notes, summaries and flashcards from your own material" },
  { old: "Copying answers from tutorials", now: "Hints that guide you to the answer yourself" },
  { old: "Guessing what to study next", now: "A day-by-day plan that adapts to your progress" },
  { old: "Installing tools before you can code", now: "Run Python and JavaScript right in the browser" },
  { old: "Finding gaps on exam day", now: "Quizzes and tests that show weak areas early" },
];

const HIGHLIGHTS = [
  { value: "24/7", label: "an AI tutor ready when you are" },
  { value: "4", label: "ways to learn every topic" },
  { value: "2", label: "languages that run in your browser" },
  { value: "0", label: "setup or installs needed" },
];

const EXTRAS: { icon: IconName; title: string; text: string }[] = [
  { icon: "mic", title: "Voice tutoring", text: "Talk to the tutor hands-free and hear its answers." },
  { icon: "clip", title: "Attach your files", text: "Ask the tutor about a PDF or code file in the chat." },
  { icon: "sliders", title: "Adaptive difficulty", text: "Questions get harder or easier as you improve." },
  { icon: "moon", title: "Light & dark", text: "Easy on the eyes, day or night." },
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
    question: "Does the tutor just give me the answers?",
    answer:
      "No. It's built to teach: it gives hints before answers, explains mistakes, and only shows a solution once you've had a real try.",
  },
  {
    question: "Which AI powers the tutor?",
    answer: "Google Gemini, guided to teach step by step and pitched at your level.",
  },
];

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold tracking-wide text-violet uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg text-ink-soft">{text}</p>}
    </div>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const primaryCta = user ? { href: "/dashboard", label: "Go to dashboard" } : { href: "/register", label: "Get started free" };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Adaptive AI Tutor home">
            <LogoMark height={52} />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-bold text-ink-soft md:flex">
            <a href="#study-sets" className="hover:text-violet">Study sets</a>
            <a href="#how-it-works" className="hover:text-violet">How it works</a>
            <a href="#features" className="hover:text-violet">Features</a>
            <a href="#faq" className="hover:text-violet">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!loading && !user && (
              <Link href="/login" className="hidden font-bold text-blue-deep hover:text-violet sm:inline">
                Log in
              </Link>
            )}
            {!loading && (
              <Link href={primaryCta.href} className="btn btn-primary px-4 py-2 text-sm">
                {user ? "Dashboard" : "Get started"}
                <Icon name="arrow" size={16} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative">
          <div aria-hidden className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div aria-hidden className="glow -top-32 -left-24 h-96 w-96 bg-blue" />
          <div aria-hidden className="glow top-24 right-0 h-80 w-80 bg-violet" />
          <div aria-hidden className="glow top-80 left-1/3 h-64 w-64 bg-cyan opacity-30" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet-tint px-3 py-1 text-xs font-bold text-violet">
                <Icon name="sparkle" size={13} /> Powered by Gemini
              </span>
              <h1 className="mt-5 text-4xl leading-[1.08] font-bold sm:text-6xl">
                Learn smarter with your own <span className="text-gradient">AI tutor</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
                Learn Python and JavaScript step by step, turn your notes into flashcards and quizzes, and follow a
                study plan built around your goal.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={primaryCta.href} className="btn btn-primary px-6 py-3 text-lg">
                  {primaryCta.label}
                  <Icon name="arrow" size={18} />
                </Link>
                <a href="#how-it-works" className="btn btn-secondary px-6 py-3 text-lg">
                  See how it works
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
                {["Free to start", "No setup", "Runs in your browser"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Icon name="check" size={15} className="text-good" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <HeroCollage />
          </div>
        </section>

        {/* ---------- Highlights ---------- */}
        <section aria-label="At a glance" className="border-y border-line bg-surface">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.label} className="text-center">
                <span className="text-gradient block text-4xl font-bold">{item.value}</span>
                <span className="mt-1 block text-sm text-ink-soft">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- The problem ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading eyebrow="Why it's hard" title="Studying shouldn't feel this hard" />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((problem, index) => (
              <li key={problem.title} className="panel card-lift p-6">
                <span className={`icon-tile ${TILE_TONES[index % TILE_TONES.length]}`}>
                  <Icon name={problem.icon} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{problem.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{problem.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Study sets ---------- */}
        <section id="study-sets" className="relative scroll-mt-20 border-t border-line bg-surface">
          <div aria-hidden className="glow top-40 -right-32 h-96 w-96 bg-violet opacity-25" />
          <div className="relative mx-auto max-w-6xl px-4 py-20">
            <SectionHeading
              eyebrow="Study sets"
              title={
                <>
                  Turn your notes into a <span className="text-gradient">study system</span>
                </>
              }
              text="Upload lecture notes, a handout or a textbook chapter on any subject, and get AI tools to understand it and remember it."
            />

            <div className="mt-14">
              <StudySetShowcase ctaHref={user ? "/study-sets" : "/register"} />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-soft">
              <span className="font-bold text-ink">Works with</span>
              {FILE_TYPES.map((file) => (
                <span key={file.label} className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1" title={file.note}>
                  <span className="bg-brand rounded px-1.5 text-[10px] font-bold">{file.label}</span>
                  {file.note}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="relative scroll-mt-20">
          <div aria-hidden className="glow -top-10 left-0 h-80 w-80 bg-cyan opacity-25" />
          <div className="relative mx-auto max-w-6xl px-4 py-20">
            <SectionHeading
              eyebrow="How it works"
              title="From “I want to learn this” to “I can prove it”"
              text="The AI guides every step, and adapts as you go."
            />
            <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <span aria-hidden className="absolute top-6 right-[10%] left-[10%] hidden h-0.5 bg-gradient-to-r from-blue via-violet to-magenta opacity-40 lg:block" />
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative text-center">
                  <span className="bg-brand mx-auto grid h-12 w-12 place-items-center rounded-full text-lg font-bold shadow-[var(--shadow-soft)]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{step.text}</p>
                </li>
              ))}
            </ol>
            <DemoVideo />
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl space-y-12 px-4 py-20">
            <SectionHeading
              eyebrow="Features"
              title={
                <>
                  Everything you need to <span className="text-gradient">learn to code</span>
                </>
              }
              text="From your first print() to passing the course exam, it's all in one place."
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.title}
                  className={`group panel card-lift flex flex-col overflow-hidden ${feature.span}`}
                  style={{
                    backgroundImage: `radial-gradient(circle at 100% 0%, color-mix(in srgb, var(${feature.glow}) 14%, transparent), transparent 55%)`,
                  }}
                >
                  <div className="p-6 pb-0 sm:p-7 sm:pb-0">
                    <div className="flex items-center gap-3">
                      <span className={`icon-tile h-10 w-10 ${TILE_TONES[index % TILE_TONES.length]}`}>
                        <Icon name={feature.icon} size={20} />
                      </span>
                      <p className="text-sm font-bold tracking-wide text-violet uppercase">{feature.eyebrow}</p>
                    </div>
                    <h3 className={`mt-4 font-bold ${index === 0 ? "text-2xl sm:text-3xl" : "text-xl"}`}>{feature.title}</h3>
                    <p className="mt-2 text-ink-soft">{feature.text}</p>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {feature.chips.map((chip) => (
                        <li key={chip} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-bold text-ink-soft">
                          {chip}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`relative mx-6 mt-6 sm:mx-7 ${index < 2 ? "h-64 sm:h-72" : "h-52"}`}>
                    <Screenshot {...feature.screenshot} fill />
                    <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />
                    <span
                      aria-hidden
                      className={`absolute top-12 -right-2 rotate-2 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-pre shadow-[var(--shadow-lift)] transition-transform group-hover:-translate-y-1 ${feature.badge.tone}`}
                    >
                      {feature.badge.text}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EXTRAS.map((extra, index) => (
                <li key={extra.title} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-4">
                  <span className={`icon-tile h-10 w-10 shrink-0 ${TILE_TONES[index % TILE_TONES.length]}`}>
                    <Icon name={extra.icon} size={19} />
                  </span>
                  <span>
                    <span className="block font-bold">{extra.title}</span>
                    <span className="block text-sm text-ink-soft">{extra.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Old way vs new way ---------- */}
        <section className="mx-auto max-w-5xl px-4 py-20">
          <SectionHeading
            eyebrow="A better way"
            title={
              <>
                The old way vs. <span className="text-gradient">Adaptive AI Tutor</span>
              </>
            }
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="panel p-6">
              <h3 className="text-lg font-bold text-ink-soft">The old way</h3>
              <ul className="mt-4 space-y-3">
                {COMPARISON.map((row) => (
                  <li key={row.old} className="flex gap-3 text-ink-soft">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bad-tint text-bad">
                      <Icon name="cross" size={12} />
                    </span>
                    {row.old}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel relative overflow-hidden border-violet/40 p-6">
              <div aria-hidden className="glow -top-20 -right-20 h-56 w-56 bg-violet opacity-20" />
              <h3 className="relative text-lg font-bold">With Adaptive AI Tutor</h3>
              <ul className="relative mt-4 space-y-3">
                {COMPARISON.map((row) => (
                  <li key={row.now} className="flex gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good-tint text-good">
                      <Icon name="check" size={13} />
                    </span>
                    {row.now}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-20">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
            <div className="mt-10 space-y-3">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group panel px-6 py-4 open:border-violet/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                    {faq.question}
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-tint text-violet transition-transform group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-ink-soft">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Final call to action ---------- */}
        <section className="px-4 py-20">
          <div className="bg-brand relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center">
            <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.5)_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative">
              <h2 className="text-3xl font-bold sm:text-4xl">Start learning today</h2>
              <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">
                Set a goal, follow your plan, and see your progress every day.
              </p>
              <Link
                href={primaryCta.href}
                className="btn mt-8 bg-white px-7 py-3 text-lg text-[#1a2fb0] hover:bg-white/90"
              >
                {primaryCta.label}
                <Icon name="arrow" size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <LogoMark height={40} />
            <p className="mt-3 max-w-sm text-sm text-ink-soft">
              Your personal AI tutor for learning to code, and a study system for everything else.
            </p>
          </div>
          <nav aria-label="Product">
            <h3 className="text-sm font-bold">Product</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li><a href="#study-sets" className="hover:text-violet">Study sets</a></li>
              <li><a href="#how-it-works" className="hover:text-violet">How it works</a></li>
              <li><a href="#features" className="hover:text-violet">Features</a></li>
              <li><a href="#faq" className="hover:text-violet">FAQ</a></li>
            </ul>
          </nav>
          <nav aria-label="Account">
            <h3 className="text-sm font-bold">Account</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {user ? (
                <li><Link href="/dashboard" className="hover:text-violet">Dashboard</Link></li>
              ) : (
                <>
                  <li><Link href="/register" className="hover:text-violet">Create an account</Link></li>
                  <li><Link href="/login" className="hover:text-violet">Log in</Link></li>
                </>
              )}
            </ul>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-ink-soft">
            &copy; {new Date().getFullYear()} Adaptive AI Tutor.
          </p>
        </div>
      </footer>
    </div>
  );
}