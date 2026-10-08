"use client";

import { useEffect, useState } from "react";

import AdminContent from "@/components/AdminContent";
import { Alert, PageHeader, Spinner, StatTile } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AdminStats, AdminUserRow } from "@/lib/types";

type Tab = "overview" | "users" | "content";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "content", label: "Content" },
];

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  // The backend checks admin access on every request; this only avoids showing an empty page.
  if (!user?.is_admin) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Alert>This area is for administrators only.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <PageHeader icon="shield" eyebrow="Administrator" title="Admin" description="Platform activity, learners, and course content." />

      <div role="tablist" aria-label="Admin sections" className="flex gap-1 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold ${
              tab === item.id ? "border-blue text-blue-deep" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "overview" && <Overview />}
        {tab === "users" && <Users />}
        {tab === "content" && <AdminContent />}
      </div>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { label: "Learners", value: stats.users, icon: "user" },
            { label: "Active in last 7 days", value: stats.active_last_7_days, icon: "flame" },
            { label: "Questions answered", value: stats.questions_answered, icon: "target" },
            { label: "Tests submitted", value: stats.tests_submitted, icon: "trophy" },
          ] as const
        ).map((stat, index) => (
          <StatTile key={stat.label} icon={stat.icon} tone={index} label={stat.label} value={stat.value.toLocaleString()} />
        ))}
      </div>

      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="px-4 pt-4 text-left text-lg font-bold">Courses</caption>
          <thead className="text-ink-soft">
            <tr>
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Topics</th>
              <th className="px-4 py-2">Learners</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stats.courses.map((course) => (
              <tr key={course.slug}>
                <td className="px-4 py-2 font-bold">{course.name}</td>
                <td className="px-4 py-2">{course.topics}</td>
                <td className="px-4 py-2">{course.learners}</td>
                <td className="px-4 py-2">{course.archived ? "Archived" : "Live"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Users() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.admin
      .users()
      .then(setUsers)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!users) return <Spinner />;

  const query = search.trim().toLowerCase();
  const shown = query
    ? users.filter((row) => row.name.toLowerCase().includes(query) || row.email.toLowerCase().includes(query))
    : users;

  return (
    <div className="space-y-3">
      <label htmlFor="user-search" className="sr-only">
        Search learners
      </label>
      <input
        id="user-search"
        className="input max-w-sm"
        placeholder="Search by name or email"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="px-4 py-2">Learner</th>
              <th className="px-4 py-2">Courses</th>
              <th className="px-4 py-2">Questions</th>
              <th className="px-4 py-2">Last active</th>
              <th className="px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2">
                  <span className="block font-bold">
                    {row.name}
                    {row.is_admin && (
                      <span className="ml-2 rounded-full bg-blue-tint px-2 py-0.5 text-xs text-blue-deep">Admin</span>
                    )}
                  </span>
                  <span className="text-ink-soft">{row.email}</span>
                </td>
                <td className="px-4 py-2">{row.subjects.join(", ")}</td>
                <td className="px-4 py-2">{row.questions_answered}</td>
                <td className="px-4 py-2">
                  {row.last_active ? new Date(row.last_active).toLocaleDateString(undefined, DATE_FORMAT) : "Never"}
                </td>
                <td className="px-4 py-2">{new Date(row.created_at).toLocaleDateString(undefined, DATE_FORMAT)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-4 text-sm text-ink-soft">No learners match that search.</p>}
      </div>
    </div>
  );
}