import Link from "next/link";

import { LogoMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-blue-tint blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-sun-tint blur-3xl"
      />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <Link href="/" className="relative mb-8 flex items-center transition-opacity hover:opacity-80">
        <LogoMark height={60} />
      </Link>
      <div className="panel relative w-full max-w-md p-6 shadow-xl shadow-black/5 sm:p-8">{children}</div>
    </div>
  );
}