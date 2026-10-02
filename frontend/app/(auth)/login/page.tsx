"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Alert } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { safeRedirectPath, useAuth } from "@/lib/auth";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeRedirectPath(searchParams.get("next"));
  const expired = searchParams.get("expired") === "1";

  useEffect(() => {
    if (!loading && user) router.replace(user.onboarding_completed ? nextPath : "/onboarding");
  }, [loading, user, router, nextPath]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // The effect above redirects once the user is set.
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-blue-tint text-blue-deep" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
      <p className="mt-1 text-ink-soft">Pick up where you left off.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {expired && !error && <Alert kind="info">Your session expired. Log in again to continue.</Alert>}
        {error && <Alert>{error}</Alert>}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-bold">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-bold">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary w-full py-3 text-base" disabled={submitting}>
          {submitting ? "Logging in…" : "Login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-bold text-blue hover:text-blue-deep">
          Register
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
