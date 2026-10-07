"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { FlashcardDeck, NotesView, StudyChat, StudyQuiz, SummaryView } from "@/components/StudySetTools";
import { Alert, Spinner } from "@/components/ui";
import WaitingMessage from "@/components/WaitingMessage";
import { api, errorMessage } from "@/lib/api";
import type { StudySet, StudyTool } from "@/lib/types";

type Tab = StudyTool | "tutor";

const TABS: { id: Tab; label: string; icon: string; waiting: string }[] = [
  { id: "notes", label: "AI Notes", icon: "📝", waiting: "Writing structured notes from your material…" },
  { id: "summary", label: "Summary", icon: "📄", waiting: "Summarizing the key points…" },
  { id: "flashcards", label: "Flashcards", icon: "🗂️", waiting: "Making flashcards…" },
  { id: "quiz", label: "Quiz", icon: "❓", waiting: "Writing quiz questions…" },
  { id: "tutor", label: "Tutor", icon: "💬", waiting: "" },
];

export default function StudySetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [set, setSet] = useState<StudySet | null>(null);
  const [tab, setTab] = useState<Tab>("notes");
  const [generating, setGenerating] = useState<StudyTool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedRef = useRef<Set<string>>(new Set());

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

  async function remove() {
    if (!set || !window.confirm(`Delete "${set.title}"? Its file, notes, flashcards, quiz and chat are removed.`)) return;
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/study-sets" className="text-sm font-bold text-blue hover:text-blue-deep">
            ← Study sets
          </Link>
          <h1 className="mt-1 text-3xl font-bold">{set.title}</h1>
          <p className="text-sm text-ink-soft">
            {set.file_name}
            {set.has_file && (
              <>
                {" · "}
                <a href={api.studySets.downloadUrl(set.id)} target="_blank" rel="noreferrer" className="font-bold text-blue hover:text-blue-deep">
                  Download original
                </a>
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-secondary text-bad" onClick={remove}>
          Delete
        </button>
      </div>

      <div role="tablist" aria-label="Study tools" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-bold whitespace-nowrap ${
              tab === item.id ? "border-blue text-blue-deep" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-4">
        {error && <Alert>{error}</Alert>}
        {generating === tab && <WaitingMessage label={active.waiting} />}
        {!ready && !generating && error && tab !== "tutor" && (
          <button type="button" className="btn btn-secondary" onClick={() => generate(tab as StudyTool)}>
            Try again
          </button>
        )}

        {tab === "notes" && set.notes && generating !== "notes" && <NotesView notes={set.notes} />}
        {tab === "summary" && set.summary && generating !== "summary" && <SummaryView summary={set.summary} />}
        {tab === "flashcards" && set.flashcards && generating !== "flashcards" && (
          <FlashcardDeck key={set.flashcards[0]?.id} setId={set.id} cards={set.flashcards} knownIds={set.known_card_ids} onSaved={setSet} />
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

        {tab !== "tutor" && tab !== "quiz" && set[tab] && !generating && (
          <button
            type="button"
            className="text-sm font-bold text-blue hover:text-blue-deep"
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