"use client";

import { useEffect, useRef, useState } from "react";

import { api, errorMessage } from "@/lib/api";
import type { Flashcard, StudySet } from "@/lib/types";

import Markdown from "./Markdown";
import { Alert } from "./ui";
import WaitingMessage from "./WaitingMessage";

export function NotesView({ notes }: { notes: NonNullable<StudySet["notes"]> }) {
  return (
    <article className="leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold">
      <Markdown content={notes.content} />
    </article>
  );
}

export function SummaryView({ summary }: { summary: NonNullable<StudySet["summary"]> }) {
  return (
    <div className="space-y-6">
      <p className="text-lg">{summary.overview}</p>
      <section className="rounded-lg border-l-4 border-sun bg-sun-tint px-4 py-3" aria-labelledby="key-points-heading">
        <h3 id="key-points-heading" className="font-bold">
          Key points
        </h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          {summary.key_points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
      {summary.key_terms.length > 0 && (
        <section aria-labelledby="key-terms-heading">
          <h3 id="key-terms-heading" className="mb-2 font-bold">
            Key terms
          </h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {summary.key_terms.map((item) => (
              <div key={item.term} className="rounded-lg border border-line px-4 py-3">
                <dt className="font-bold">{item.term}</dt>
                <dd className="text-sm text-ink-soft">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

type CardResult = "known" | "review";

/**
 * Flip cards for active recall, in rounds. A round ends with a finish screen showing only the cards
 * marked "Review again", with options to review those, go through every card, or get new cards that
 * don't repeat the deck. "I knew it" progress is saved.
 */
export function FlashcardDeck({
  setId,
  cards,
  knownIds,
  onSaved,
}: {
  setId: string;
  cards: Flashcard[];
  knownIds: string[];
  onSaved: (set: StudySet) => void;
}) {
  const [known, setKnown] = useState<Set<string>>(() => new Set(knownIds));
  // The first round is the cards not yet known (or every card, once all are known).
  const [round, setRound] = useState<Flashcard[]>(() => {
    const unknown = cards.filter((card) => !knownIds.includes(card.id));
    return unknown.length ? unknown : cards;
  });
  const [roundLabel, setRoundLabel] = useState(() =>
    cards.some((card) => knownIds.includes(card.id)) ? "Cards you haven't marked as known" : "All cards",
  );
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, CardResult>>({});
  const [finished, setFinished] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = round[position];
  const reviewCards = round.filter((item) => results[item.id] === "review");
  const knewCount = round.filter((item) => results[item.id] === "known").length;
  const skippedCount = round.length - knewCount - reviewCards.length;

  function startRound(next: Flashcard[], label: string) {
    setRound(next);
    setRoundLabel(label);
    setPosition(0);
    setFlipped(false);
    setResults({});
    setFinished(false);
    setError(null);
  }

  function goTo(nextPosition: number) {
    setFlipped(false);
    if (nextPosition >= round.length) setFinished(true);
    else setPosition(Math.max(0, nextPosition));
  }

  function mark(result: CardResult) {
    if (!card) return;
    setResults((current) => ({ ...current, [card.id]: result }));
    const next = new Set(known);
    if (result === "known") next.add(card.id);
    else next.delete(card.id);
    setKnown(next);
    api.studySets
      .saveFlashcardProgress(setId, [...next])
      .then(onSaved)
      .catch(() => undefined); // progress is a convenience; the deck keeps working
    goTo(position + 1);
  }

  async function getNewCards() {
    setLoadingMore(true);
    setError(null);
    try {
      const { study_set: updated, new_card_ids: newIds } = await api.studySets.moreFlashcards(setId);
      onSaved(updated);
      const fresh = (updated.flashcards ?? []).filter((item) => newIds.includes(item.id));
      startRound(fresh, `${fresh.length} new card${fresh.length === 1 ? "" : "s"}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  if (finished) {
    return (
      <div className="space-y-5" role="status">
        <div className="rounded-2xl border-2 border-good/40 bg-good-tint p-6 text-center">
          <p className="text-3xl" aria-hidden>
            🎉
          </p>
          <h3 className="mt-1 text-2xl font-bold">Deck finished!</h3>
          <p className="mt-1 text-ink">
            You knew {knewCount} of {round.length}
            {reviewCards.length > 0 && ` · ${reviewCards.length} to review`}
            {skippedCount > 0 && ` · ${skippedCount} skipped`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {known.size} of {cards.length} cards in this deck are marked as known.
          </p>
        </div>

        {reviewCards.length > 0 ? (
          <section aria-labelledby="review-heading" className="space-y-2">
            <h3 id="review-heading" className="font-bold">
              Cards to review
            </h3>
            <ul className="space-y-2">
              {reviewCards.map((item) => (
                <li key={item.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                  <p className="font-bold">{item.front}</p>
                  <p className="mt-1 text-sm text-ink-soft">{item.back}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-center text-ink-soft">No cards marked for review in this round. Great work!</p>
        )}

        {error && <Alert>{error}</Alert>}
        {loadingMore && <WaitingMessage label="Making new cards that aren't already in your deck…" />}

        {!loadingMore && (
          <div className="flex flex-wrap justify-center gap-2">
            {reviewCards.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startRound(reviewCards, `Reviewing ${reviewCards.length} card${reviewCards.length === 1 ? "" : "s"}`)}
              >
                Review these {reviewCards.length} card{reviewCards.length === 1 ? "" : "s"}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => startRound(shuffled(cards), "All cards")}>
              Go through all cards again
            </button>
            <button type="button" className={reviewCards.length ? "btn btn-secondary" : "btn btn-primary"} onClick={getNewCards}>
              Get new cards
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-ink-soft">
          <span className="font-bold text-ink">{roundLabel}</span> · {known.size} of {cards.length} known
        </span>
        <button
          type="button"
          onClick={() => startRound(shuffled(round), roundLabel)}
          className="rounded-full border border-line px-3 py-1 font-bold text-ink-soft hover:text-ink"
        >
          Shuffle
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
        <div className="h-full bg-blue transition-all" style={{ width: `${(position / round.length) * 100}%` }} />
      </div>

      {card && (
        <>
          <button
            type="button"
            onClick={() => setFlipped((current) => !current)}
            aria-label={flipped ? "Show the question" : "Show the answer"}
            className={`grid min-h-56 w-full place-items-center rounded-2xl border-2 p-8 text-center transition-colors ${
              flipped ? "border-blue bg-blue-tint" : "border-line bg-surface hover:border-blue/50"
            }`}
          >
            <span>
              <span className="mb-3 block text-xs font-bold tracking-wide text-ink-soft uppercase">
                {flipped ? "Answer" : "Question"} · {position + 1} of {round.length}
              </span>
              <span className="block text-xl font-bold" aria-live="polite">
                {flipped ? card.back : card.front}
              </span>
              {!flipped && <span className="mt-4 block text-sm text-ink-soft">Click to reveal the answer</span>}
            </span>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn btn-secondary" disabled={position === 0} onClick={() => goTo(position - 1)}>
              ← Previous
            </button>
            {flipped ? (
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => mark("review")}>
                  Review again
                </button>
                <button type="button" className="btn btn-primary" onClick={() => mark("known")}>
                  I knew it ✓
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setFlipped(true)}>
                Reveal answer
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => goTo(position + 1)}>
              {position === round.length - 1 ? "Finish" : "Skip →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A multiple-choice quiz on the material, marked on submit with explanations. */
export function StudyQuiz({
  setId,
  questions,
  onSaved,
  onNewQuiz,
}: {
  setId: string;
  questions: NonNullable<StudySet["quiz"]>["questions"];
  onSaved: (set: StudySet) => void;
  onNewQuiz: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = questions.filter((question, index) => answers[index] === question.correct_option).length;
  const allAnswered = Object.keys(answers).length === questions.length;

  function submit() {
    setSubmitted(true);
    api.studySets
      .saveQuizResult(setId, score, questions.length)
      .then(onSaved)
      .catch(() => undefined);
  }

  return (
    <div className="space-y-5">
      {submitted && (
        <p className={`rounded-lg px-4 py-3 font-bold ${score / questions.length >= 0.7 ? "bg-good-tint text-good" : "bg-sun-tint"}`} role="status">
          You scored {score} of {questions.length} ({Math.round((score / questions.length) * 100)}%).
        </p>
      )}
      <ol className="space-y-4">
        {questions.map((question, questionIndex) => (
          <li key={questionIndex} className="panel space-y-3 p-5">
            <p className="font-bold">
              {questionIndex + 1}. {question.question}
            </p>
            <fieldset className="space-y-2" disabled={submitted}>
              <legend className="sr-only">Options</legend>
              {question.options.map((option, optionIndex) => {
                const chosen = answers[questionIndex] === optionIndex;
                const isRight = optionIndex === question.correct_option;
                const style = submitted
                  ? isRight
                    ? "border-good bg-good-tint"
                    : chosen
                      ? "border-bad bg-bad-tint"
                      : "border-line"
                  : chosen
                    ? "border-blue bg-blue-tint"
                    : "border-line hover:border-blue/50";
                return (
                  <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 ${style}`}>
                    <input
                      type="radio"
                      name={`question-${questionIndex}`}
                      checked={chosen}
                      onChange={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                      className="accent-blue"
                    />
                    {option}
                  </label>
                );
              })}
            </fieldset>
            {submitted && <p className="text-sm text-ink-soft">{question.explanation}</p>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {!submitted ? (
          <button type="button" className="btn btn-primary" disabled={!allAnswered} onClick={submit}>
            {allAnswered ? "Submit answers" : `Answer all ${questions.length} questions to submit`}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Try again
            </button>
            <button type="button" className="btn btn-primary" onClick={onNewQuiz}>
              New questions
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** A tutor that answers questions about this study set's material. */
export function StudyChat({ set }: { set: StudySet }) {
  const [messages, setMessages] = useState(set.chat);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    setSending(true);
    setInput("");
    setMessages((current) => [...current, { role: "student", content: message, created_at: new Date().toISOString() }]);
    try {
      const { reply } = await api.studySets.chat(set.id, message);
      setMessages((current) => [...current, reply]);
    } catch (err) {
      setError(errorMessage(err));
      setMessages((current) => current.slice(0, -1));
      setInput(message);
    } finally {
      setSending(false);
    }
  }

  const suggestions = ["Explain the main idea simply", "Quiz me on this", "What should I remember for a test?"];

  return (
    <div className="space-y-4">
      <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-xl border border-line bg-paper p-4" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-ink-soft">Ask anything about this material.</p>}
        {messages.map((message, index) => (
          <div key={`${message.created_at}-${index}`} className={message.role === "student" ? "flex justify-end" : ""}>
            {message.role === "student" ? (
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue px-4 py-2 whitespace-pre-wrap text-on-accent">{message.content}</p>
            ) : (
              <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
                <Markdown content={message.content} />
              </div>
            )}
          </div>
        ))}
        {sending && <WaitingMessage label="Thinking…" />}
        <div ref={endRef} />
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={sending}
            onClick={() => send(suggestion)}
            className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-blue hover:text-blue-deep"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="study-chat" className="sr-only">
          Ask about this material
        </label>
        <input
          id="study-chat"
          className="input"
          maxLength={2000}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about this material…"
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}