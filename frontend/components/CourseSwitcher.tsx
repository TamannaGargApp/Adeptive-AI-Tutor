"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Subject } from "@/lib/types";

/** Chooses which course in the learner's plan the whole app shows. */
export default function CourseSwitcher() {
  const { user, setUser } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [switching, setSwitching] = useState(false);
  const planKey = user?.subjects.join(",") ?? "";

  useEffect(() => {
    if (!planKey) return;
    api
      .getSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [planKey]);

  if (!user || subjects.length === 0) return null;
  const inPlan = subjects.filter((subject) => user.subjects.includes(subject.slug));

  async function switchCourse(slug: string) {
    if (!user || slug === user.current_subject) return;
    setSwitching(true);
    try {
      setUser(await api.setCurrentSubject(slug));
    } catch {
      // The select simply stays on the current course.
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div>
      <label htmlFor="course-switcher" className="sr-only">
        Current course
      </label>
      <select
        id="course-switcher"
        className="input w-auto py-1.5 pr-8 text-sm font-bold"
        value={user.current_subject}
        disabled={switching}
        onChange={(event) => switchCourse(event.target.value)}
      >
        {inPlan.map((subject) => (
          <option key={subject.slug} value={subject.slug}>
            {subject.name}
          </option>
        ))}
      </select>
    </div>
  );
}