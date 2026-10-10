"use client";

import { readAttachment } from "./attachments";
import type { MaterialInput } from "./types";

/** All the files in one study set together can be up to 2 GB (matches the backend). */
export const STUDY_SET_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const STUDY_SET_MAX_FILES = 20;
export const STUDY_SET_ACCEPT = ".pdf,.txt,.md";
// Text read from each file. Longer files use their beginning (matches MAX_TEXT_CHARS).
const MAX_CHARS = 120_000;

/** Read a file's text in the browser, ready to send before its original is uploaded. */
export async function readStudyMaterial(file: File): Promise<MaterialInput> {
  const attachment = await readAttachment(file, { maxBytes: STUDY_SET_MAX_BYTES, maxChars: MAX_CHARS });
  if (attachment.text.length < 50) {
    throw new Error(`${file.name} has too little text to study from.`);
  }
  const lowerName = file.name.toLowerCase();
  return {
    file_name: file.name,
    content_type: file.type || (lowerName.endsWith(".md") ? "text/markdown" : lowerName.endsWith(".pdf") ? "application/pdf" : "text/plain"),
    file_size: file.size,
    text: attachment.text,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const shown = value < 10 && !Number.isInteger(value) ? value.toFixed(1) : String(Math.round(value));
  return `${shown} ${units[unit]}`;
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "Study set";
}
