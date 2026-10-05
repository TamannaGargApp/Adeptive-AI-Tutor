"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import { readAttachment } from "@/lib/attachments";
import { useAuth } from "@/lib/auth";
import type {
  AdminCourse,
  AdminTopic,
  CourseDeletePreview,
  CourseInput,
  CourseNotesFile,
  TopicInput,
  TopicMaterial,
} from "@/lib/types";

import Modal from "./Modal";
import { Alert, Spinner } from "./ui";
import WaitingMessage from "./WaitingMessage";

type Editing =
  | { kind: "new-course" }
  | { kind: "course"; course: AdminCourse }
  | { kind: "new-topic" }
  | { kind: "topic"; topic: AdminTopic }
  | { kind: "delete-course"; course: AdminCourse }
  | { kind: "material"; topic: AdminTopic }
  | { kind: "course-notes"; topic: AdminTopic }
  | null;

function ArchivedBadge() {
  return <span className="rounded-full border border-line px-2 py-0.5 text-xs font-bold text-ink-soft">Archived</span>;
}

/** Create and edit courses and topics. Content is archived, never deleted, so learner progress stays valid. */
export default function AdminContent() {
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [topics, setTopics] = useState<AdminTopic[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const closeEditor = useCallback(() => setEditing(null), []);
  const { setUser } = useAuth();

  const loadCourses = useCallback(async (select?: string) => {
    try {
      const list = await api.admin.courses();
      setCourses(list);
      setSelectedSlug((current) => select ?? current ?? list[0]?.slug ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!selectedSlug) return;
    setTopics(null);
    api.admin
      .topics(selectedSlug)
      .then(setTopics)
      .catch((err) => setError(errorMessage(err)));
  }, [selectedSlug]);

  const course = courses?.find((item) => item.slug === selectedSlug);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function topicInput(topic: AdminTopic, changes: Partial<TopicInput> = {}): TopicInput {
    return { name: topic.name, description: topic.description, key_concepts: topic.key_concepts, archived: topic.archived, ...changes };
  }

  if (!courses) return error ? <Alert>{error}</Alert> : <Spinner />;

  return (
    <div className="space-y-5">
      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="admin-course" className="mb-1 block text-sm font-bold">
            Course
          </label>
          <select
            id="admin-course"
            className="input w-auto pr-8"
            value={selectedSlug ?? ""}
            onChange={(event) => setSelectedSlug(event.target.value)}
          >
            {courses.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
                {item.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </div>
        {course && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing({ kind: "course", course })}>
              Edit course
            </button>
            <button
              type="button"
              className="btn btn-secondary text-bad"
              onClick={() => setEditing({ kind: "delete-course", course })}
            >
              Delete course
            </button>
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => setEditing({ kind: "new-course" })}>
          New course
        </button>
      </div>

      {course && (
        <section className="panel" aria-labelledby="topics-admin-heading">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <h2 id="topics-admin-heading" className="flex-1 font-bold">
              {course.name} topics {course.archived && <ArchivedBadge />}
            </h2>
            <button type="button" className="btn btn-primary px-3 py-1.5 text-sm" onClick={() => setEditing({ kind: "new-topic" })}>
              Add topic
            </button>
          </div>
          {!topics && (
            <div className="p-4">
              <Spinner />
            </div>
          )}
          {topics?.length === 0 && <p className="p-4 text-sm text-ink-soft">No topics yet.</p>}
          <ol className="divide-y divide-line">
            {topics?.map((topic, index) => (
              <li key={topic.slug} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${topic.archived ? "opacity-60" : ""}`}>
                <span className="w-6 text-sm text-ink-soft">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {topic.name} {topic.archived && <ArchivedBadge />}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    <span className="font-mono">{topic.slug}</span> · {topic.key_concepts.length} key concepts
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary px-2 py-1 text-sm"
                    aria-label={`Move ${topic.name} up`}
                    disabled={index === 0}
                    onClick={() => run(async () => setTopics(await api.admin.moveTopic(topic.slug, "up")))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-2 py-1 text-sm"
                    aria-label={`Move ${topic.name} down`}
                    disabled={index === topics.length - 1}
                    onClick={() => run(async () => setTopics(await api.admin.moveTopic(topic.slug, "down")))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-1 text-sm"
                    onClick={() => setEditing({ kind: "topic", topic })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-1 text-sm"
                    onClick={() => setEditing({ kind: "material", topic })}
                    title="The Read-mode study notes learners see"
                  >
                    Study notes
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-1 text-sm"
                    onClick={() => setEditing({ kind: "course-notes", topic })}
                    title="Upload your own notes for the tutor to teach from"
                  >
                    Course notes
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-1 text-sm"
                    onClick={() =>
                      run(async () => {
                        const updated = await api.admin.updateTopic(topic.slug, topicInput(topic, { archived: !topic.archived }));
                        setTopics((current) => current?.map((item) => (item.slug === updated.slug ? updated : item)) ?? null);
                      })
                    }
                  >
                    {topic.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(editing?.kind === "new-course" || editing?.kind === "course") && (
        <Modal title={editing.kind === "course" ? `Edit ${editing.course.name}` : "New course"} onClose={closeEditor}>
          <CourseForm
            initial={editing.kind === "course" ? editing.course : undefined}
            onSave={async (data) => {
              const saved =
                editing.kind === "course"
                  ? await api.admin.updateCourse(editing.course.slug, data)
                  : await api.admin.createCourse(data);
              await loadCourses(saved.slug);
              closeEditor();
            }}
          />
        </Modal>
      )}

      {editing?.kind === "delete-course" && (
        <Modal title={`Delete ${editing.course.name}`} onClose={closeEditor}>
          <DeleteCourseDialog
            course={editing.course}
            onDeleted={async () => {
              // The admin's own plan may have included the deleted course.
              setUser(await api.me());
              setSelectedSlug(null);
              await loadCourses();
              closeEditor();
            }}
          />
        </Modal>
      )}

      {editing?.kind === "material" && (
        <Modal title={`${editing.topic.name}: study notes`} onClose={closeEditor}>
          <MaterialEditor topic={editing.topic} onSaved={closeEditor} />
        </Modal>
      )}

      {editing?.kind === "course-notes" && (
        <Modal title={`${editing.topic.name}: course notes`} onClose={closeEditor}>
          <CourseNotesManager topic={editing.topic} />
        </Modal>
      )}

      {course && (editing?.kind === "new-topic" || editing?.kind === "topic") && (
        <Modal title={editing.kind === "topic" ? `Edit ${editing.topic.name}` : `New ${course.name} topic`} onClose={closeEditor}>
          <TopicForm
            initial={editing.kind === "topic" ? editing.topic : undefined}
            onSave={async (data) => {
              if (editing.kind === "topic") await api.admin.updateTopic(editing.topic.slug, data);
              else await api.admin.createTopic(course.slug, data);
              setTopics(await api.admin.topics(course.slug));
              closeEditor();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function DeleteCourseDialog({ course, onDeleted }: { course: AdminCourse; onDeleted: () => Promise<void> }) {
  const [preview, setPreview] = useState<CourseDeletePreview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin
      .deletePreview(course.slug)
      .then(setPreview)
      .catch((err) => setError(errorMessage(err)));
  }, [course.slug]);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.admin.deleteCourse(course.slug);
      await onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  if (!preview) return <div className="p-5">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;

  if (!preview.can_delete) {
    return (
      <div className="p-5">
        <Alert kind="info">{preview.reason}</Alert>
      </div>
    );
  }

  const matches = confirmation.trim() === course.name;
  return (
    <div className="space-y-4 p-5">
      {error && <Alert>{error}</Alert>}
      <div className="rounded-lg border-l-4 border-bad bg-bad-tint px-4 py-3 text-sm">
        <p className="font-bold text-bad">This permanently deletes the course. It can&apos;t be undone.</p>
        <ul className="mt-1 list-disc pl-5 text-ink">
          <li>
            {preview.topics} topics and their study notes
          </li>
          <li>
            All progress, chats, questions and test results for it ({preview.answers.toLocaleString()} answers)
          </li>
          <li>
            It will be removed from {preview.learners} learner{preview.learners === 1 ? "'s" : "s'"} plans
          </li>
        </ul>
        <p className="mt-2 text-ink">To hide it but keep everything, archive it instead (Edit course).</p>
      </div>
      <FormField id="delete-confirm" label={`Type "${course.name}" to confirm`}>
        <input
          id="delete-confirm"
          className="input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
        />
      </FormField>
      <button type="button" className="btn w-full bg-bad text-on-accent" disabled={!matches || deleting} onClick={confirmDelete}>
        {deleting ? "Deleting…" : `Delete ${course.name} permanently`}
      </button>
    </div>
  );
}

function MaterialEditor({ topic, onSaved }: { topic: AdminTopic; onSaved: () => void }) {
  const [material, setMaterial] = useState<TopicMaterial | null>(null);
  const [content, setContent] = useState("");
  const [takeaways, setTakeaways] = useState("");
  const [busy, setBusy] = useState<"loading" | "saving" | "regenerating" | null>("loading");
  const [error, setError] = useState<string | null>(null);

  function show(loaded: TopicMaterial) {
    setMaterial(loaded);
    setContent(loaded.content);
    setTakeaways(loaded.key_takeaways.join("\n"));
  }

  useEffect(() => {
    // Opening the notes generates them with the AI if they don't exist yet.
    api
      .getTopicMaterial(topic.slug)
      .then(show)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setBusy(null));
  }, [topic.slug]);

  async function run(kind: "saving" | "regenerating", action: () => Promise<TopicMaterial>, close: boolean) {
    setBusy(kind);
    setError(null);
    try {
      show(await action());
      if (close) onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const takeawayList = takeaways.split("\n").map((item) => item.trim()).filter(Boolean);

  return (
    <div className="space-y-4 p-5">
      {error && <Alert>{error}</Alert>}
      {busy === "loading" && <WaitingMessage label="Loading the notes (written by the AI if they don't exist yet)…" />}
      {busy === "regenerating" && <WaitingMessage label="Rewriting the notes…" />}
      {material && busy !== "regenerating" && (
        <>
          <p className="text-xs text-ink-soft">
            {material.edited ? "Edited by an admin" : "Written by the AI"} · last updated{" "}
            {new Date(material.updated_at).toLocaleString()}
          </p>
          <FormField id="material-content" label="Notes (Markdown)" hint="Use ## for sections and ``` fences for code examples.">
            <textarea
              id="material-content"
              className="input font-mono text-sm"
              rows={14}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </FormField>
          <FormField id="material-takeaways" label="Key takeaways (one per line)">
            <textarea
              id="material-takeaways"
              className="input"
              rows={4}
              value={takeaways}
              onChange={(event) => setTakeaways(event.target.value)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() => run("saving", () => api.admin.updateMaterial(topic.slug, content, takeawayList), true)}
            >
              {busy === "saving" ? "Saving…" : "Save notes"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm("Replace these notes with a new AI-written version? Your edits will be lost.")) {
                  void run("regenerating", () => api.admin.regenerateMaterial(topic.slug), false);
                }
              }}
            >
              Regenerate with AI
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Admin notes can be longer than learner attachments.
const NOTES_LIMITS = { maxBytes: 20 * 1024 * 1024, maxChars: 200_000 };

// Must match MAX_FILES_PER_TOPIC in notes_service.py.
const MAX_NOTES_FILES = 5;

interface NotesDraft {
  name: string;
  text: string;
  truncated: boolean;
}

/**
 * Upload, review and remove the course notes the tutor teaches a topic from. Several files can be
 * chosen at once; each is reviewed (PDF text can need fixing) before it's saved.
 */
function CourseNotesManager({ topic }: { topic: AdminTopic }) {
  const [files, setFiles] = useState<CourseNotesFile[] | null>(null);
  // Files read and waiting for review; the first one is the one on screen.
  const [queue, setQueue] = useState<NotesDraft[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.admin
      .listNotes(topic.slug)
      .then(setFiles)
      .catch((err) => setError(errorMessage(err)));
  }, [topic.slug]);

  useEffect(load, [load]);

  const draft = queue[0] ?? null;

  async function readFiles(chosen: File[]) {
    setBusy("reading");
    setError(null);
    setSavedCount(0);
    const existing = new Set(files?.map((file) => file.file_name));
    let room = MAX_NOTES_FILES - existing.size;
    const drafts: NotesDraft[] = [];
    const problems: string[] = [];
    for (const file of chosen) {
      // A file with the same name replaces the existing one, so it doesn't need a free slot.
      if (!existing.has(file.name) && room <= 0) {
        problems.push(`${file.name} wasn't added: a topic can have up to ${MAX_NOTES_FILES} notes files.`);
        continue;
      }
      try {
        const attachment = await readAttachment(file, NOTES_LIMITS);
        drafts.push({ name: attachment.name, text: attachment.text, truncated: attachment.truncated });
        if (!existing.has(file.name)) room -= 1;
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `${file.name} couldn't be read.`);
      }
    }
    if (problems.length) setError(problems.join(" "));
    setQueue(drafts);
    setQueueSize(drafts.length);
    setBusy(null);
  }

  function nextFile() {
    setQueue((current) => current.slice(1));
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy("saving");
    setError(null);
    try {
      await api.admin.uploadNotes(topic.slug, draft.name, draft.text);
      setSavedCount((count) => count + 1);
      nextFile();
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(file: CourseNotesFile) {
    if (!window.confirm(`Remove ${file.file_name}? The tutor will stop using it for ${topic.name}.`)) return;
    setError(null);
    try {
      await api.admin.deleteNotes(file.id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-ink-soft">
        The tutor uses these notes as its main source for {topic.name} in Learn, Practice, quizzes and the topic
        test, and adds what they lack (such as examples) itself. Learners never see the files.
      </p>
      {error && <Alert>{error}</Alert>}
      {!draft && savedCount > 0 && (
        <Alert kind="info">
          {savedCount} file{savedCount === 1 ? "" : "s"} saved. To rebuild this topic&apos;s Read-mode notes from them,
          open Study notes and choose Regenerate.
        </Alert>
      )}

      {!draft && (
        <>
          {!files && <Spinner />}
          {files?.length === 0 && <p className="text-sm text-ink-soft">No course notes for this topic yet.</p>}
          {files && files.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{file.file_name}</span>
                    <span className="text-xs text-ink-soft">
                      {file.sections} sections · {file.characters.toLocaleString()} characters ·{" "}
                      {new Date(file.uploaded_at).toLocaleDateString()}
                    </span>
                  </span>
                  <button type="button" className="text-xs font-bold text-bad hover:underline" onClick={() => remove(file)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.txt"
            multiple
            className="hidden"
            onChange={(event) => {
              const chosen = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (chosen.length) void readFiles(chosen);
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null || (files?.length ?? 0) >= MAX_NOTES_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy === "reading" ? "Reading files…" : "Upload notes (PDF, Markdown or text)"}
          </button>
          <p className="text-xs text-ink-soft">
            You can select several files at once. Up to {MAX_NOTES_FILES} files per topic; uploading a file with the
            same name replaces it. For Word documents, save as PDF first.
          </p>
        </>
      )}

      {draft && (
        <div className="space-y-3">
          <p className="text-sm">
            {queueSize > 1 && (
              <span className="mr-2 rounded-full bg-blue-tint px-2 py-0.5 text-xs font-bold text-blue-deep">
                Reviewing {queueSize - queue.length + 1} of {queueSize}
              </span>
            )}
            <span className="font-bold">Review {draft.name}</span> before saving: PDF text can come out messy. Fix
            anything that reads wrongly. Headings starting with <code>#</code> help the tutor find the right section.
          </p>
          {draft.truncated && (
            <Alert kind="info">This file is very long, so only its first 200,000 characters are used.</Alert>
          )}
          <label htmlFor="notes-draft" className="sr-only">
            Extracted notes text
          </label>
          <textarea
            key={draft.name}
            id="notes-draft"
            className="input font-mono text-sm"
            rows={14}
            value={draft.text}
            onChange={(event) => {
              const text = event.target.value;
              setQueue((current) => [{ ...current[0], text }, ...current.slice(1)]);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={saveDraft}>
              {busy === "saving" ? "Saving…" : queue.length > 1 ? "Save and continue" : "Save notes"}
            </button>
            {queue.length > 1 && (
              <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={nextFile}>
                Skip this file
              </button>
            )}
            <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => setQueue([])}>
              {queue.length > 1 ? "Cancel the rest" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function useSave<T>(onSave: (data: T) => Promise<void>) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(data: T) {
    setSaving(true);
    setError(null);
    try {
      await onSave(data);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }
  return { saving, error, save };
}

function CourseForm({ initial, onSave }: { initial?: AdminCourse; onSave: (data: CourseInput) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "python");
  const [archived, setArchived] = useState(initial?.archived ?? false);
  const { saving, error, save } = useSave(onSave);

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save({ name, description, language, archived });
      }}
    >
      {error && <Alert>{error}</Alert>}
      <FormField id="course-name" label="Name" hint={initial ? `Slug: ${initial.slug} (can't be changed)` : undefined}>
        <input id="course-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
      </FormField>
      <FormField id="course-description" label="Description">
        <textarea
          id="course-description"
          className="input"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </FormField>
      <FormField id="course-language" label="Code language" hint="Used for code examples and for running coding exercises.">
        <select id="course-language" className="input" value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
      </FormField>
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Archived (hidden from learners; their progress is kept)
        </label>
      )}
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : initial ? "Save course" : "Create course"}
      </button>
    </form>
  );
}

function TopicForm({ initial, onSave }: { initial?: AdminTopic; onSave: (data: TopicInput) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [concepts, setConcepts] = useState((initial?.key_concepts ?? []).join("\n"));
  const [archived, setArchived] = useState(initial?.archived ?? false);
  const { saving, error, save } = useSave(onSave);

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save({
          name,
          description,
          key_concepts: concepts.split("\n").map((concept) => concept.trim()).filter(Boolean),
          archived,
        });
      }}
    >
      {error && <Alert>{error}</Alert>}
      <FormField id="topic-name" label="Name" hint={initial ? `Slug: ${initial.slug} (can't be changed)` : undefined}>
        <input id="topic-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
      </FormField>
      <FormField id="topic-description" label="Description">
        <textarea
          id="topic-description"
          className="input"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </FormField>
      <FormField
        id="topic-concepts"
        label="Key concepts (one per line)"
        hint="Learners must answer each key concept correctly to complete the topic. Renaming a concept means past correct answers on it no longer count."
      >
        <textarea
          id="topic-concepts"
          className="input font-mono"
          rows={6}
          value={concepts}
          onChange={(event) => setConcepts(event.target.value)}
          required
        />
      </FormField>
      {initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Archived (hidden from learners; their progress is kept)
        </label>
      )}
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : initial ? "Save topic" : "Create topic"}
      </button>
    </form>
  );
}