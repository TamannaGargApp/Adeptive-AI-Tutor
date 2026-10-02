"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/topics", label: "Topics" },
  { href: "/tutor", label: "Tutor" },
  { href: "/quiz", label: "Quiz" },
  { href: "/final-test", label: "Final test" },
  { href: "/progress", label: "Progress" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="flex items-center text-ink">
          <LogoMark height={48} />
        </Link>

        {user?.onboarding_completed && (
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Main">
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold ${
                    active ? "bg-blue-tint text-blue-deep" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThemeToggle />
          {user && <span className="hidden text-ink-soft md:inline">{user.name}</span>}
          <button type="button" onClick={handleLogout} className="font-bold text-blue hover:text-blue-deep">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}