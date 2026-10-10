"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { FlashcardDeck, NotesView, StudyChat, StudyQuiz, SummaryView } from "@/components/StudySetTools";
import { Alert, CompletionBar, PageHeader, Spinner } from "@/components/ui";
import WaitingMessage from "@/components/WaitingMessage";
import { api, errorMessage } from "@/lib/api";
import { formatBytes, readStudyMaterial, STUDY_SET_ACCEPT, STUDY_SET_MAX_FILES } from "@/lib/studySetFiles";
import type { StudyMaterial, StudySet, StudyTool } from "@/lib/types";

type Tab = StudyTool | "tutor";

const TABS: { id: Tab; label: string; icon: IconName; waiting: string }[] = [
  { id: "notes", label: "AI Notes", icon: "notes", waiting: "Writing structured notes from your material…" },
  { id: "summary", label: "Summary", icon: "summary", waiting: "Summarizing the key points…" },
  { id: "flashcards", label: "Flashcards", icon: "cards", waiting: "Making flashcards…" },
  { id: "quiz", label: "Quiz", icon: "quiz", waiting: "Writing quiz questions…" },
  { id: "tutor", label: "Tutor", icon: "chat", waiting: "" },
];

const TOOL_NAMES: Record<StudyTool, string> = { notes: "notes", summary: "summary", flashcards: "flashcards", quiz: "quiz" };

/** A file being read or uploaded from this browser. */
interface PendingFile {
  key: string;
  name: string;
  size: number;
  stage: "waiting" | "reading" | "uploading" | "failed";
  progress: number;
  error?: string;
}

export default function StudySetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [set, setSet] = useState<StudySet | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [generating, setGenerating] = useState<StudyTool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const requestedRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.studySets
      .get(id)
      .then(setSet)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  const generate = useCallback(
    async (tool: StudyTool, regenerate = false) => {
      setGenerating(tool);
      setError(null);
      try {
        setSet(await api.studySets.generate(id, tool, regenerate));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setGenerating(null);
      }
    },
    [id],
  );

  // Each tool is created the first time its tab is opened, then saved.
  useEffect(() => {
    if (!set || tab === "tutor" || set[tab] || requestedRef.current.has(tab)) return;
    requestedRef.current.add(tab);
    void generate(tab);
  }, [set, tab, generate]);

  const updatePending = (key: string, change: Partial<PendingFile>) =>
    setPending((items) => items.map((item) => (item.key === key ? { ...item, ...change } : item)));

  /** Add files one after another: read the text, save it, then upload the original. */
  async function addFiles(files: File[]) {
    if (!set) return;
    setError(null);
    setFilesOpen(true);
    const items = files.map((file, index) => ({
      key: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      stage: "waiting" as const,
      progress: 0,
    }));
    setPending((current) => [...current, ...items]);

    for (const [index, file] of files.entries()) {
      const { key } = items[index];
      try {
        updatePending(key, { stage: "reading" });
        const material = await readStudyMaterial(file);
        const added = await api.studySets.addMaterial(id, material);
        setSet(added.study_set);
        updatePending(key, { stage: "uploading" });
        try {
          setSet(await api.studySets.uploadOriginal(id, added.upload, file, (progress) => updatePending(key, { progress })));
        } catch (err) {
          // The text is already saved and used; only the downloadable original is missing.
          setError(`${file.name} was added, but its original file couldn't be saved: ${errorMessage(err)}`);
        }
        setPending((current) => current.filter((item) => item.key !== key));
      } catch (err) {
        updatePending(key, { stage: "failed", error: errorMessage(err) });
      }
    }
  }

  async function removeMaterial(material: StudyMaterial) {
    if (!window.confirm(`Remove "${material.file_name}" from this study set? Its file is deleted.`)) return;
    try {
      setSet(await api.studySets.removeMaterial(id, material.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function addCardsFromNewFiles() {
    setGenerating("flashcards");
    setError(null);
    try {
      setSet((await api.studySets.moreFlashcards(id)).study_set);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(null);
    }
  }

  async function remove() {
    if (!set || !window.confirm(`Delete "${set.title}"? Its files, notes, flashcards, quiz and chat are removed.`)) return;
    try {
      await api.studySets.remove(set.id);
      router.replace("/study-sets");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!set) return <div className="p-6">{error ? <Alert>{error}</Alert> : <Spinner />}</div>;

  const active = TABS.find((item) => item.id === tab)!;
  const ready = tab === "tutor" || Boolean(set[tab]);
  const stale = tab !== "tutor" && set[tab] && set.stale_tools.includes(tab) && !generating;
  const busy = pending.some((item) => item.stage !== "failed");
  const full = set.materials.length >= STUDY_SET_MAX_FILES || set.storage_used >= set.storage_limit;
  const usedPercent = Math.min(100, Math.round((set.storage_used / set.storage_limit) * 100));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div>
        <Link href="/study-sets" className="inline-flex items-center gap-1 text-sm font-bold text-violet hover:text-blue">
          <span aria-hidden className="inline-block rotate-180">
            <Icon name="arrow" size={15} />
          </span>
          Study sets
        </Link>
      </div>

      <PageHeader
        icon="notes"
        eyebrow="Study set"
        title={set.title}
        description={
          <>
            {set.materials.length} file{set.materials.length === 1 ? "" : "s"} · {formatBytes(set.storage_used)} of{" "}
            {formatBytes(set.storage_limit)} used
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || full}
              onClick={() => fileInputRef.current?.click()}
              title={full ? "This study set is full" : undefined}
            >
              <Icon name="plus" size={17} /> Add files
            </button>
            <button type="button" className="btn btn-secondary text-bad" onClick={remove}>
              Delete
            </button>
          </>
        }
      />
      <div className="hidden">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={STUDY_SET_ACCEPT}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void addFiles(files);
          }}
        />
      </div>

      {/* The set's files */}
      <section className="panel overflow-hidden" aria-labelledby="files-heading">
        <button
          type="button"
          onClick={() => setFilesOpen((open) => !open)}
          aria-expanded={filesOpen}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-paper"
        >
          <span aria-hidden className="icon-tile h-10 w-10 bg-violet-tint text-violet">
            <Icon name="layers" size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span id="files-heading" className="block font-bold">
              Files in this set
            </span>
            <span className="block truncate text-sm text-ink-soft">
              {set.materials.map((material) => material.file_name).join(", ")}
            </span>
          </span>
          <span className="hidden w-40 shrink-0 sm:block">
            <CompletionBar percent={usedPercent} label="Storage used" />
            <span className="mt-1 block text-right text-xs text-ink-soft">{usedPercent}% of 2 GB</span>
          </span>
          <span aria-hidden className={`shrink-0 text-ink-soft transition-transform ${filesOpen ? "-rotate-90" : "rotate-90"}`}>
            <Icon name="arrow" size={16} />
          </span>
        </button>

        {filesOpen && (
          <div className="border-t border-line">
            <ul className="divide-y divide-line">
              {set.materials.map((material) => (
                <li key={material.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-paper text-[10px] font-bold text-ink-soft uppercase">
                    {material.file_name.split(".").pop()?.slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-bold">{material.file_name}</p>
                    <p className="text-xs text-ink-soft">
                      {formatBytes(material.size)} · added {new Date(material.added_at).toLocaleDateString()}
                      {!material.has_file && " · text only (original not saved)"}
                    </p>
                  </div>
                  <div className="ml-12 flex items-center gap-1 sm:ml-0">
                    {material.has_file && (
                      <a
                        href={api.studySets.downloadUrl(set.id, material.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary px-3 py-1 text-sm"
                      >
                        Download
                      </a>
                    )}
                    {set.materials.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMaterial(material)}
                        className="rounded-lg px-3 py-1 text-sm font-bold text-ink-soft hover:bg-bad-tint hover:text-bad"
                        aria-label={`Remove ${material.file_name}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {pending.map((item) => (
                <li key={item.key} className="space-y-2 px-5 py-3" role="status">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-tint text-violet">
                      {item.stage === "failed" ? <Icon name="cross" size={16} /> : <Icon name="upload" size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{item.name}</p>
                      <p className={`text-xs ${item.stage === "failed" ? "text-bad" : "text-ink-soft"}`}>
                        {item.stage === "waiting" && "Waiting…"}
                        {item.stage === "reading" && "Reading the text…"}
                        {item.stage === "uploading" &&
                          `Uploading ${formatBytes(item.size * item.progress)} of ${formatBytes(item.size)}`}
                        {item.stage === "failed" && item.error}
                      </p>
                    </div>
                    {item.stage === "failed" && (
                      <button
                        type="button"
                        className="text-sm font-bold text-ink-soft hover:text-ink"
                        onClick={() => setPending((current) => current.filter((other) => other.key !== item.key))}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                  {item.stage === "uploading" && (
                    <CompletionBar percent={Math.round(item.progress * 100)} label={`Uploading ${item.name}`} />
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-line bg-paper px-5 py-3 text-xs text-ink-soft">
              PDF, text or Markdown files. Up to {STUDY_SET_MAX_FILES} files and 2 GB per study set. For very long files,
              the AI studies the first part (about 120,000 characters).
            </p>
          </div>
        )}
      </section>

      {/* Tool tabs: pills in a scrolling row, so there's no stray scrollbar on wide screens. */}
      <div
        role="tablist"
        aria-label="Study tools"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors ${
                selected ? "bg-brand shadow-[var(--shadow-soft)]" : "text-ink-soft hover:bg-paper hover:text-ink"
              }`}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
              {item.id !== "tutor" && set.stale_tools.includes(item.id) && (
                <span aria-label="(out of date)" className="h-1.5 w-1.5 rounded-full bg-sun" />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="space-y-4">
        {error && <Alert>{error}</Alert>}

        {stale && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sun/60 bg-sun-tint px-4 py-3">
            <span aria-hidden className="shrink-0 text-ink">
              <Icon name="sparkle" size={18} />
            </span>
            <p className="min-w-0 flex-1 text-sm text-ink">
              <strong>Made before your files changed.</strong> Update to cover all {set.materials.length} file
              {set.materials.length === 1 ? "" : "s"} in this set.
            </p>
            {tab === "flashcards" ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary px-3 py-1.5 text-sm" onClick={addCardsFromNewFiles}>
                  Add new cards
                </button>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-1.5 text-sm"
                  onClick={() => {
                    if (window.confirm("Make a whole new deck? Your known-card progress starts again.")) void generate("flashcards", true);
                  }}
                >
                  New deck
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary px-3 py-1.5 text-sm" onClick={() => generate(tab as StudyTool, true)}>
                Update {TOOL_NAMES[tab as StudyTool]}
              </button>
            )}
          </div>
        )}

        {generating === tab && <WaitingMessage label={active.waiting} />}
        {/* !ready already means a tool tab (the tutor tab is always ready). */}
        {!ready && !generating && error && (
          <button type="button" className="btn btn-secondary" onClick={() => generate(tab as StudyTool)}>
            Try again
          </button>
        )}

        {tab === "notes" && set.notes && generating !== "notes" && <NotesView notes={set.notes} />}
        {tab === "summary" && set.summary && generating !== "summary" && <SummaryView summary={set.summary} />}
        {tab === "flashcards" && set.flashcards && generating !== "flashcards" && (
          <FlashcardDeck
            key={`${set.flashcards[0]?.id}-${set.flashcards.length}`}
            setId={set.id}
            cards={set.flashcards}
            knownIds={set.known_card_ids}
            onSaved={setSet}
          />
        )}
        {tab === "quiz" && set.quiz && generating !== "quiz" && (
          <StudyQuiz
            key={set.quiz.questions[0]?.question}
            setId={set.id}
            questions={set.quiz.questions}
            onSaved={setSet}
            onNewQuiz={() => generate("quiz", true)}
          />
        )}
        {tab === "tutor" && <StudyChat set={set} />}

        {tab !== "tutor" && tab !== "quiz" && set[tab] && !generating && !stale && (
          <button
            type="button"
            className="text-sm font-bold text-violet hover:text-blue"
            onClick={() => {
              if (window.confirm("Create a new version? The current one will be replaced.")) void generate(tab, true);
            }}
          >
            ↻ Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
