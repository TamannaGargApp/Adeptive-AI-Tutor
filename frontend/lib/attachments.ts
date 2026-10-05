"use client";

/**
 * Files learners attach in Learn chat.
 *
 * Text is extracted here in the browser (PDFs with pdf.js), and kept in this browser's IndexedDB,
 * linked to the conversation. The server never stores file contents: the text is sent with each
 * question and used for that request only. On another device the conversation is still there,
 * but the file has to be attached again.
 */

export interface Attachment {
  name: string;
  text: string;
  pages: number | null;
  /** True when the file was longer than the limit and only its beginning is used. */
  truncated: boolean;
  addedAt: string;
}

// Limits must match the backend (MAX_ATTACHMENTS and MAX_ATTACHMENT_CHARS in schemas/tutor.py).
export const MAX_ATTACHMENTS = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CHARS = 60_000;
const TEXT_EXTENSIONS = [".txt", ".md", ".py", ".js", ".json", ".csv"];
export const ACCEPTED_FILES = [".pdf", ...TEXT_EXTENSIONS].join(",");

interface ReadLimits {
  maxBytes: number;
  maxChars: number;
}

const LEARNER_LIMITS: ReadLimits = { maxBytes: MAX_FILE_BYTES, maxChars: MAX_CHARS };

/** Read a file's text in the browser. Admin course notes pass larger limits than learner attachments. */
export async function readAttachment(file: File, limits: ReadLimits = LEARNER_LIMITS): Promise<Attachment> {
  if (file.size > limits.maxBytes) {
    throw new Error(`${file.name} is larger than ${Math.round(limits.maxBytes / 1024 / 1024)} MB.`);
  }
  const lowerName = file.name.toLowerCase();

  let text: string;
  let pages: number | null = null;
  if (lowerName.endsWith(".pdf")) {
    ({ text, pages } = await extractPdfText(file));
  } else if (TEXT_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    text = await file.text();
    // A "text" file full of NUL bytes is really binary (e.g. a renamed image).
    if ((text.match(/\u0000/g)?.length ?? 0) > 10) throw new Error(`${file.name} doesn't look like a text file.`);
  } else {
    throw new Error(`${file.name} isn't supported. Attach a PDF, text, Markdown, Python or JavaScript file.`);
  }

  text = text.trim();
  if (!text) {
    throw new Error(`No text could be read from ${file.name}. Scanned PDFs (pictures of pages) aren't supported.`);
  }
  const truncated = text.length > limits.maxChars;
  return {
    name: file.name,
    text: truncated ? text.slice(0, limits.maxChars) : text,
    pages,
    truncated,
    addedAt: new Date().toISOString(),
  };
}

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  // Loaded only when a PDF is attached, so the library isn't part of every page load.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pageTexts: string[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return { text: pageTexts.join("\n\n"), pages: pdf.numPages };
}

// ---------- Browser storage (IndexedDB), one list of attachments per conversation ----------

const DB_NAME = "adaptive-ai-tutor";
const STORE = "chat-attachments";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = action(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

export async function loadAttachments(sessionId: string): Promise<Attachment[]> {
  try {
    return (await withStore<Attachment[] | undefined>("readonly", (store) => store.get(sessionId))) ?? [];
  } catch {
    return []; // Storage blocked (e.g. some private browsing modes): attachments just won't persist.
  }
}

export async function saveAttachments(sessionId: string, attachments: Attachment[]): Promise<void> {
  try {
    await withStore("readwrite", (store) =>
      attachments.length ? store.put(attachments, sessionId) : store.delete(sessionId),
    );
  } catch {
    // Not saved; the files still work until the page is closed.
  }
}