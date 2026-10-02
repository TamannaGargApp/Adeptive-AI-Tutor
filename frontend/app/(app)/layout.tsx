"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import Navbar from "@/components/Navbar";
import { FullPageSpinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Guards every signed-in page: requires login, and onboarding before anything else. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionExpired } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const needsOnboarding = Boolean(user && !user.onboarding_completed && pathname !== "/onboarding");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const query = new URLSearchParams({ next: pathname });
      if (sessionExpired) query.set("expired", "1");
      router.replace(`/login?${query.toString()}`);
    } else if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [loading, user, sessionExpired, needsOnboarding, pathname, router]);

  if (loading || !user || needsOnboarding) return <FullPageSpinner />;

  // The tutor is a full-height app screen (like a chat app): the page itself never scrolls,
  // only the panels inside it do. Every other page scrolls normally.
  const fullHeight = pathname.startsWith("/tutor");

  return (
    <div className={fullHeight ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-screen flex-col"}>
      <Navbar />
      <main className={fullHeight ? "flex min-h-0 flex-1 flex-col" : "flex flex-1 flex-col"}>{children}</main>
    </div>
  );
}