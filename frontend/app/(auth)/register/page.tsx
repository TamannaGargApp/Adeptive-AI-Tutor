"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (values.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords don't match.";
  return errors;
}

const FIELDS: { key: keyof FormValues; label: string; type: string; autoComplete: string }[] = [
  { key: "name", label: "Name", type: "text", autoComplete: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { key: "confirmPassword", label: "Confirm Password", type: "password", autoComplete: "new-password" },
];

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ name: "", email: "", password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(user.onboarding_completed ? "/dashboard" : "/onboarding");
  }, [loading, user, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setError(null);
    setSubmitting(true);
    try {
      // Registration logs the learner in, so they go straight to onboarding.
      await register(values.name.trim(), values.email.trim(), values.password);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-blue-tint text-blue-deep" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M17 8h4M19 6v4" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-ink-soft">It takes a minute. Then we&apos;ll tailor lessons to you.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}

        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={field.key} className="block text-sm font-bold">
              {field.label}
            </label>
            <input
              id={field.key}
              type={field.type}
              autoComplete={field.autoComplete}
              className={`input ${fieldErrors[field.key] ? "border-bad focus:border-bad" : ""}`}
              value={values[field.key]}
              aria-invalid={Boolean(fieldErrors[field.key])}
              aria-describedby={fieldErrors[field.key] ? `${field.key}-error` : undefined}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            />
            {fieldErrors[field.key] && (
              <p id={`${field.key}-error`} className="text-sm text-bad">
                {fieldErrors[field.key]}
              </p>
            )}
          </div>
        ))}

        <button type="submit" className="btn btn-primary w-full py-3 text-base" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-blue hover:text-blue-deep">
          Log in
        </Link>
      </p>
    </>
  );
}
