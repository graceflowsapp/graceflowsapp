"use client";

/**
 * Talks to faq.worker.ts. The worker (and the ~120 MB model) is only started when `startSemantic()` is called:
 * only after the user taps "Aktifkan" (opt-in, see HelpChatbot) or has done so before. If anything fails, the chatbot keeps working with the
 * lexical layer (Fuse.js) only.
 */
import type { FaqItem, SemanticScores } from "./types";
import type { WorkerIn, WorkerOut } from "./faq.worker";

export type SemanticStatus =
  | { state: "idle" }
  | { state: "loading"; pct: number; stage: "download" | "embed" }
  | { state: "ready" }
  | { state: "off"; reason: string };

/** Max time to wait for the model to score a question before answering with the lexical layer only. */
export const SEMANTIC_TIMEOUT_MS = 2500;

let worker: Worker | null = null;
let status: SemanticStatus = { state: "idle" };
const listeners = new Set<(s: SemanticStatus) => void>();
const pending = new Map<number, (s: SemanticScores | null) => void>();
let nextReq = 1;

function setStatus(s: SemanticStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}

export function getSemanticStatus() {
  return status;
}

export function onSemanticStatus(fn: (s: SemanticStatus) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Short hash of the FAQ texts: the cached embeddings are rebuilt whenever the FAQ changes. */
function hashKey(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function startSemantic(items: FaqItem[]) {
  if (worker || status.state === "off") return;
  if (typeof Worker === "undefined" || typeof indexedDB === "undefined" || typeof WebAssembly === "undefined") {
    return setStatus({ state: "off", reason: "Browser tidak mendukung" });
  }
  // Respect "Data Saver": don't download a large model on a metered connection.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return setStatus({ state: "off", reason: "Mode hemat data aktif" });

  try {
    worker = new Worker(new URL("./faq.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return setStatus({ state: "off", reason: "Worker gagal dibuat" });
  }
  setStatus({ state: "loading", pct: 0, stage: "download" });

  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    const m = e.data;
    if (m.type === "progress") setStatus({ state: "loading", pct: m.pct, stage: m.stage });
    else if (m.type === "ready") setStatus({ state: "ready" });
    else if (m.type === "error") fail(m.message);
    else if (m.type === "scores") {
      pending.get(m.reqId)?.(Object.keys(m.scores).length ? m.scores : null);
      pending.delete(m.reqId);
    }
  };
  worker.onerror = (e) => fail(e.message || "Worker error");

  const entries = items.map((f) => ({ id: f.id, texts: [f.pertanyaan, ...f.variasi] }));
  const key = `v1-${hashKey(JSON.stringify(entries))}`;
  worker.postMessage({ type: "init", key, entries } satisfies WorkerIn);
}

function fail(reason: string) {
  console.warn("[chatbot] semantic layer disabled:", reason);
  worker?.terminate();
  worker = null;
  pending.forEach((resolve) => resolve(null));
  pending.clear();
  setStatus({ state: "off", reason });
}

/** Cosine similarity per FAQ id, or null when the model isn't ready / too slow / failed. */
export function semanticScores(text: string): Promise<SemanticScores | null> {
  if (!worker || status.state !== "ready") return Promise.resolve(null);
  const reqId = nextReq++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(reqId);
      resolve(null);
    }, SEMANTIC_TIMEOUT_MS);
    pending.set(reqId, (s) => {
      clearTimeout(timer);
      resolve(s);
    });
    worker!.postMessage({ type: "query", reqId, text } satisfies WorkerIn);
  });
}
