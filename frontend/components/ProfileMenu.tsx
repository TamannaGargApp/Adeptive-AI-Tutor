"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";

import CourseSwitcher from "./CourseSwitcher";

export interface NavItem {
  href: string;
  label: string;
}

const HAMBURGER = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
  </svg>
);

/** The menu behind the learner's name: the main pages, Achievements, Admin, and log out. */
export default function ProfileMenu({ mainLinks }: { mainLinks: NavItem[] }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when navigating, clicking outside, or pressing Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  const personalLinks: NavItem[] = user.onboarding_completed
    ? [{ href: "/achievements", label: "Achievements" }, ...(user.is_admin ? [{ href: "/admin", label: "Admin" }] : [])]
    : [];
  const itemClass = (href: string) =>
    `block rounded-md px-3 py-2 text-sm font-bold ${
      pathname.startsWith(href) ? "bg-blue-tint text-blue-deep" : "text-ink hover:bg-paper"
    }`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open menu"
        className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm font-bold hover:border-blue/50"
      >
        <span className="hidden max-w-[10rem] truncate sm:inline">{user.name}</span>
        {HAMBURGER}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-xl">
          <div className="border-b border-line px-3 pt-1 pb-3">
            <p className="truncate font-bold">{user.name}</p>
            <p className="truncate text-sm text-ink-soft">{user.email}</p>
          </div>

          {user.onboarding_completed && mainLinks.length > 0 && (
            <nav aria-label="Main" className="border-b border-line py-2">
              {mainLinks.map((link) => (
                <Link key={link.href} href={link.href} className={itemClass(link.href)}>
                  {link.label}
                </Link>
              ))}
              <div className="px-3 pt-2 sm:hidden">
                <CourseSwitcher />
              </div>
            </nav>
          )}

          {personalLinks.length > 0 && (
            <div className="border-b border-line py-2">
              {personalLinks.map((link) => (
                <Link key={link.href} href={link.href} className={itemClass(link.href)}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-bold text-bad hover:bg-bad-tint"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}