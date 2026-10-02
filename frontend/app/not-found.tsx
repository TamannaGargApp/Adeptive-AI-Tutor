import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-ink-soft">That page doesn&apos;t exist. Head back to your dashboard to keep learning.</p>
      <Link href="/dashboard" className="btn btn-primary">
        Go to dashboard
      </Link>
    </div>
  );
}
