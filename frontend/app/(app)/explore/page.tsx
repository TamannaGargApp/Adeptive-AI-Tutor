"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { Alert, PageHeader, Spinner, TONES } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { courseIcon, languageLabel } from "@/lib/courses";
import type { Subject, Topic } from "@/lib/types";


/** The course catalogue: every course, with details and an option to add it to the learner's plan. */
export default function ExploreCoursesPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeDetails = useCallback(() => setOpenSlug(null), []);

  const loadSubjects = useCallback(() => {
    api
      .getSubjects()
      .then(setSubjects)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Reload when the plan changes, so "In your plan" badges stay accurate.
  useEffect(loadSubjects, [loadSubjects, user?.subjects.join(","), user?.current_subject]);

  const selected = subjects?.find((subject) => subject.slug === openSlug);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        icon="compass"
        title="Explore courses"
        description="Every course you can study. Open one to see its topics and add it to My courses."
      />

      {error && <Alert>{error}</Alert>}
      {!subjects && !error && <Spinner />}

      {subjects && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject, index) => (
            <button
              key={subject.slug}
              type="button"
              onClick={() => setOpenSlug(subject.slug)}
              aria-haspopup="dialog"
              className={`group panel card-lift flex flex-col gap-3 p-5 text-left ${
                subject.current ? "border-violet/50 ring-2 ring-violet/15" : ""
              }`}
            >
              <span className="flex w-full items-start justify-between gap-3">
                <span aria-hidden className={`icon-tile h-12 w-12 ${TONES[index % TONES.length]}`}>
                  <Icon name={courseIcon(`${subject.slug} ${subject.name}`)} size={22} />
                </span>
                <PlanBadge subject={subject} />
              </span>
              <span className="text-xl font-bold">{subject.name}</span>
              <span className="line-clamp-3 text-sm text-ink-soft">{subject.description}</span>
              <span className="mt-auto flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {subject.topic_count} topics · {languageLabel(subject.language)}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-violet">
                  Details <Icon name="arrow" size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Modal title={selected.name} onClose={closeDetails}>
          <CourseDetails subject={selected} onPlanChanged={loadSubjects} />
        </Modal>
      )}
    </div>
  );
}

function PlanBadge({ subject }: { subject: Subject }) {
  if (subject.current)
    return <span className="shrink-0 rounded-full bg-blue-tint px-2.5 py-0.5 text-xs font-bold text-blue-deep">Current</span>;
  if (subject.in_plan)
    return <span className="shrink-0 rounded-full bg-good-tint px-2.5 py-0.5 text-xs font-bold text-good">In My courses</span>;
  return null;
}

function CourseDetails({ subject, onPlanChanged }: { subject: Subject; onPlanChanged: () => void }) {
  const { setUser } = useAuth();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // With a study plan, adding a course asks whether it joins the plan or is studied on its own.
  const [hasStudyPlan, setHasStudyPlan] = useState(false);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    api
      .getStudyPlan()
      .then((plan) => setHasStudyPlan(plan !== null))
      .catch(() => setHasStudyPlan(false));
  }, []);

  async function addCourse(intoStudyPlan: boolean) {
    await changePlan(() => api.addSubjectToPlan(subject.slug));
    // The plan itself only changes once the learner approves the new draft.
    if (intoStudyPlan) router.push(`/study-plan?add=${subject.slug}`);
  }

  useEffect(() => {
    api
      .getTopics(subject.slug)
      .then(setTopics)
      .catch((err) => setError(errorMessage(err)));
  }, [subject.slug]);

  async function changePlan(action: () => ReturnType<typeof api.addSubjectToPlan>) {
    setBusy(true);
    setError(null);
    try {
      setUser(await action());
      onPlanChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-soft">{subject.description}</p>
        <PlanBadge subject={subject} />
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {!subject.in_plan && !choosing && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => (hasStudyPlan ? setChoosing(true) : void addCourse(false))}
          >
            {busy ? "Adding…" : "Add to My courses"}
          </button>
        )}
        {!subject.in_plan && choosing && (
          <div className="w-full space-y-2 rounded-lg border border-line bg-paper p-4">
            <p className="font-bold">Add {subject.name} to your study plan, or study it on its own?</p>
            <p className="text-sm text-ink-soft">
              Adding it to your plan shows you an updated plan to approve first. Your current plan doesn&apos;t change
              until you accept.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => addCourse(true)}>
                Add to my study plan
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => addCourse(false)}>
                Study it on its own
              </button>
            </div>
          </div>
        )}
        {subject.in_plan && !subject.current && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => changePlan(() => api.setCurrentSubject(subject.slug))}
          >
            Switch to {subject.name}
          </button>
        )}
        {subject.current && (
          <Link href="/dashboard" className="btn btn-primary">
            Continue learning
          </Link>
        )}
        {subject.in_plan && (
          <Link href="/courses" className="btn btn-secondary">
            Go to My courses
          </Link>
        )}
      </div>

      <section aria-labelledby="course-topics-heading">
        <h3 id="course-topics-heading" className="mb-2 text-sm font-bold text-ink-soft">
          {subject.topic_count} topics
        </h3>
        {!topics && !error && <Spinner />}
        {topics && (
          <ol className="space-y-2">
            {topics.map((topic, index) => (
              <li key={topic.slug} className="flex gap-3 rounded-lg border border-line px-3 py-2">
                <span className="w-6 shrink-0 text-sm text-ink-soft">{index + 1}.</span>
                <span>
                  <span className="block font-bold">{topic.name}</span>
                  <span className="text-sm text-ink-soft">{topic.description}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}