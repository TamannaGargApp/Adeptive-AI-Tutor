"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import { Alert, CompletionBar, PageHeader, Spinner, TONES } from "@/components/ui";
import WaitingMessage from "@/components/WaitingMessage";
import { api, errorMessage } from "@/lib/api";
import { formatBytes, readStudyMaterial, STUDY_SET_ACCEPT, titleFromFileName } from "@/lib/studySetFiles";
import type { StudySetSummary } from "@/lib/types";

const TOOL_LABELS: Record<string, string> = { notes: "Notes", summary: "Summary", flashcards: "Flashcards", quiz: "Quiz" };
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

type UploadState = { name: string; size: number; stage: "reading" | "uploading"; progress: number };

export default function StudySetsPage() {
  const router = useRouter();
  const [sets, setSets] = useState<StudySetSummary[] | null>(null);
  const [uploading, setUploading] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.studySets
      .list()
      .then(setSets)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function upload(file: File) {
    setUploading({ name: file.name, size: file.size, stage: "reading", progress: 0 });
    setError(null);
    let created: Awaited<ReturnType<typeof api.studySets.create>>;
    try {
      const material = await readStudyMaterial(file);
      created = await api.studySets.create({ ...material, title: titleFromFileName(file.name) });
    } catch (err) {
      setError(errorMessage(err));
      setUploading(null);
      return;
    }
    // The set already works from the file's text, so if saving the original fails the learner
    // still gets their study set; the file list there shows it as "text only".
    try {
      setUploading({ name: file.name, size: file.size, stage: "uploading", progress: 0 });
      await api.studySets.uploadOriginal(created.study_set.id, created.upload, file, (progress) =>
        setUploading((current) => current && { ...current, progress }),
      );
    } catch {
      // Shown on the study set page.
    }
    router.push(`/study-sets/${created.study_set.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        icon="notes"
        title="Study sets"
        description="Turn your own notes, handouts or textbook chapters into AI notes, a summary, flashcards, a quiz and a tutor, on any subject."
        actions={
          <button type="button" className="btn btn-primary" disabled={Boolean(uploading)} onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={17} /> New study set
          </button>
        }
      />
      <div className="hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept={STUDY_SET_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>

      {error && <Alert>{error}</Alert>}
      {uploading?.stage === "reading" && <WaitingMessage label={`Reading ${uploading.name}…`} />}
      {uploading?.stage === "uploading" && (
        <div className="panel space-y-2 p-4" role="status">
          <p className="flex justify-between gap-3 text-sm">
            <span className="truncate font-bold">Saving {uploading.name}</span>
            <span className="shrink-0 text-ink-soft">
              {formatBytes(uploading.size * uploading.progress)} of {formatBytes(uploading.size)}
            </span>
          </p>
          <CompletionBar percent={Math.round(uploading.progress * 100)} label="Upload progress" />
        </div>
      )}
      {!sets && !error && <Spinner />}

      {sets?.length === 0 && !uploading && (
        <section className="panel space-y-3 p-8 text-center">
          <p className="text-4xl" aria-hidden>
            📚
          </p>
          <h2 className="text-xl font-bold">Make your first study set</h2>
          <p className="mx-auto max-w-md text-ink-soft">
            Upload a PDF, text or Markdown file. A study set can hold several files, up to 2 GB in total. Scanned
            PDFs (photos of pages) can&apos;t be read.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            Upload a file
          </button>
        </section>
      )}

      {sets && sets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sets.map((set, index) => (
            <Link key={set.id} href={`/study-sets/${set.id}`} className="group panel card-lift flex flex-col gap-3 p-5">
              <span className="flex items-start justify-between gap-3">
                <span aria-hidden className={`icon-tile h-12 w-12 ${TONES[index % TONES.length]}`}>
                  <Icon name="notes" size={22} />
                </span>
                <span className="rounded-md border border-line bg-paper px-2 py-0.5 text-[11px] font-bold text-ink-soft uppercase">
                  {set.material_count > 1 ? `${set.material_count} files` : set.file_name.split(".").pop()}
                </span>
              </span>
              <span className="text-lg font-bold">{set.title}</span>
              <span className="truncate text-sm text-ink-soft">
                {set.material_count > 1 ? `${set.file_name} + ${set.material_count - 1} more` : set.file_name} ·{" "}
                {new Date(set.created_at).toLocaleDateString(undefined, DATE_FORMAT)}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {set.tools_ready.map((tool) => (
                  <span key={tool} className="rounded-full bg-violet-tint px-2.5 py-0.5 text-xs font-bold text-violet">
                    {TOOL_LABELS[tool]}
                  </span>
                ))}
              </span>
              {set.tools_ready.length === 0 && (
                <span className="text-xs text-ink-soft">Open it to create notes, a summary and more.</span>
              )}
              <span className="mt-auto border-t border-line pt-3 text-sm text-ink-soft empty:hidden">
                {set.flashcards_total > 0 && `${set.flashcards_known}/${set.flashcards_total} cards known`}
                {set.flashcards_total > 0 && set.last_quiz && " · "}
                {set.last_quiz && `Quiz ${set.last_quiz.score}/${set.last_quiz.total}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}