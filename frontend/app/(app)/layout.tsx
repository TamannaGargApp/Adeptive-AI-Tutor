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

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
