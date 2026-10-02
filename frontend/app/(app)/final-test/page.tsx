"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import FinalTestResults from "@/components/FinalTestResults";
import FinalTestRunner from "@/components/FinalTestRunner";
import { Alert, Spinner } from "@/components/ui";
import WaitingMessage from "@/components/WaitingMessage";
import { api, errorMessage } from "@/lib/api";
import { finalTestLink } from "@/lib/labels";
import type { FinalTest, Topic } from "@/lib/types";

function FinalTestPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const topicSlug = searchParams.get("topic");
  const testId = searchParams.get("test");

  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [test, setTest] = useState<FinalTest | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedTestRef = useRef<string | null>(null);

  useEffect(() => {
    api
      .getTopics()
      .then(setTopics)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  // Resume a test from the URL, e.g. after a page refresh.
  useEffect(() => {
    if (!testId || loadedTestRef.current === testId) return;
    loadedTestRef.current = testId;
    setError(null);
    api
      .getFinalTest(testId)
      .then(setTest)
      .catch((err) => setError(errorMessage(err)));
  }, [testId]);

  async function startTest(slug: string) {
    setStarting(true);
    setError(null);
    try {
      const created = await api.startFinalTest(slug);
      loadedTestRef.current = created.id;
      setTest(created);
      router.replace(`/final-test?test=${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const handleFinished = useCallback((finished: FinalTest) => setTest(finished), []);

  function retake() {
    if (!test) return;
    const slug = test.topic_slug;
    setTest(null);
    loadedTestRef.current = null;
    router.replace(finalTestLink(slug));
  }

  const topic = topics?.find((item) => item.slug === topicSlug);

  let content: React.ReactNode;
  if (testId && test && test.id === testId) {
    if (!test.submitted) {
      content = <FinalTestRunner test={test} onFinished={handleFinished} />;
    } else if (test.result) {
      content = <FinalTestResults test={test} result={test.result} onRetake={retake} />;
    } else {
      content = <Alert>Your answers were submitted, but the results aren&apos;t ready. Refresh the page to try again.</Alert>;
    }
  } else if (testId) {
    content = error ? null : <Spinner label="Loading your test…" />;
  } else if (starting) {
    content = <WaitingMessage label="Writing your final test. This can take a few seconds…" />;
  } else if (!topics) {
    content = error ? null : <Spinner />;
  } else if (topic) {
    content = <TestIntro topic={topic} onStart={() => startTest(topic.slug)} />;
  } else {
    content = <TopicPicker topics={topics} onPick={(slug) => router.replace(finalTestLink(slug))} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {error && <Alert>{error}</Alert>}
      {content}
    </div>
  );
}

function TopicPicker({ topics, onPick }: { topics: Topic[]; onPick: (slug: string) => void }) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Final test</h1>
        <p className="mt-2 text-ink-soft">A timed test on a whole topic. Choose a topic to see the rules.</p>
      </div>
      <ul className="panel divide-y divide-line">
        {topics.map((item) => (
          <li key={item.slug}>
            <button type="button" onClick={() => onPick(item.slug)} className="w-full px-4 py-3 text-left hover:bg-paper">
              <span className="block font-bold">{item.name}</span>
              <span className="text-sm text-ink-soft">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function TestIntro({ topic, onStart }: { topic: Topic; onStart: () => void }) {
  return (
    <div className="panel space-y-5 p-6">
      <div>
        <p className="text-sm font-bold text-ink-soft">Final test</p>
        <h1 className="text-3xl font-bold">{topic.name}</h1>
      </div>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>10 questions covering every key concept in this topic.</li>
        <li>15 minutes. The timer starts as soon as the questions appear.</li>
        <li>Move freely between questions and change answers until you submit.</li>
        <li>Answers and explanations are revealed only after you submit, with a full analysis.</li>
        <li>Answers are saved as you go. The test submits automatically when time runs out.</li>
        <li>Unanswered questions count as incorrect, and results count toward your topic progress.</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={onStart}>
          Start final test
        </button>
        <Link href="/final-test" className="btn btn-secondary">
          Choose another topic
        </Link>
      </div>
    </div>
  );
}

export default function FinalTestPage() {
  return (
    <Suspense>
      <FinalTestPageContent />
    </Suspense>
  );
}
