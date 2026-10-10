"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoMark } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

import CourseSwitcher from "./CourseSwitcher";
import PlanChip from "./PlanChip";
import ProfileMenu, { type NavItem } from "./ProfileMenu";
import StreakChip from "./StreakChip";
import ThemeToggle from "./ThemeToggle";

// The main pages live in the profile menu (name + ☰), keeping the header uncluttered.
const MAIN_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/study-plan", label: "Study plan" },
  { href: "/courses", label: "My courses" },
  { href: "/topics", label: "Topics" },
  { href: "/study-sets", label: "Study sets" },
  { href: "/tutor", label: "Tutor" },
  { href: "/final-test", label: "Final test" },
  { href: "/progress", label: "Progress" },
];

/**
 * Left: logo and the course catalogue. Right: streak, course switcher, theme switcher, and the profile
 * menu (name + ☰) holding the main pages, Achievements, Admin and log out.
 */
export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const onboarded = Boolean(user?.onboarding_completed);

  const linkClass = (href: string) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold ${
      pathname.startsWith(href) ? "bg-blue-tint text-blue-deep" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-3">
        <Link href="/dashboard" className="flex shrink-0 items-center text-ink">
          <LogoMark height={48} />
        </Link>
        {onboarded && (
          <Link href="/explore" aria-current={pathname.startsWith("/explore") ? "page" : undefined} className={`hidden sm:inline-block ${linkClass("/explore")}`}>
            Courses
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {onboarded && (
            <div className="hidden sm:block">
              <PlanChip />
            </div>
          )}
          {onboarded && <StreakChip />}
          {onboarded && (
            <div className="hidden sm:block">
              <CourseSwitcher />
            </div>
          )}
          <ThemeToggle />
          <ProfileMenu mainLinks={onboarded ? MAIN_LINKS : []} />
        </div>
      </div>
      {/* A thin line in the logo's colours under the header. */}
      <div aria-hidden className="bar-glow h-0.5 opacity-80" />
    </header>
  );
}