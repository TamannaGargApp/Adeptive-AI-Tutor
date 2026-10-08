import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

const POINTS = [
  "Courses in Python and JavaScript, step by step",
  "A tutor that gives hints, not just answers",
  "Study plans, flashcards and quizzes from your notes",
];

/**
 * Login and register: a brand panel on the left (large screens only) and the form on the right.
 * The brand panel is always dark, so it uses the white-text logo in both themes.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
        style={{ background: "linear-gradient(145deg, #10175a 0%, #241b6b 45%, #3f1d78 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgb(255_255_255/0.35)_1px,transparent_1px)] [background-size:24px_24px]"
        />
        <div aria-hidden className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#00b0f0] opacity-25 blur-[90px]" />
        <div aria-hidden className="absolute -right-20 -bottom-24 h-96 w-96 rounded-full bg-[#d24bf0] opacity-25 blur-[90px]" />

        <Link href="/" className="relative w-fit transition-opacity hover:opacity-85" aria-label="Adaptive AI Tutor home">
          <Image src="/logo-dark.png" alt="Adaptive AI Tutor" width={168} height={80} priority />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-bold">
            Learn smarter with your own{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, #4fd2f7, #9f7bff 55%, #e27df7)" }}
            >
              AI tutor
            </span>
          </h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-white/90">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15">
                  <Icon name="check" size={14} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden className="relative max-w-sm rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-white/70 uppercase">
            <Icon name="sparkle" size={13} /> Hint from your tutor
          </p>
          <p className="mt-2 text-sm text-white/90">
            Close! Think about where <code className="font-mono text-[#9fe7fb]">range(3)</code> starts counting. What is
            the very first number it gives you?
          </p>
        </div>
      </aside>

      <main className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-10">
        <div aria-hidden className="glow -top-24 -right-24 h-72 w-72 bg-violet opacity-20" />
        <div aria-hidden className="glow -bottom-24 -left-24 h-72 w-72 bg-cyan opacity-15" />

        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <Link href="/" className="relative mb-8 flex items-center transition-opacity hover:opacity-80 lg:hidden">
          <LogoMark height={60} />
        </Link>
        <div className="panel relative w-full max-w-md p-6 shadow-[var(--shadow-lift)] sm:p-8">{children}</div>
      </main>
    </div>
  );
}
