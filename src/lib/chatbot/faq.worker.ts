/**
 * Web Worker: semantic layer of the help chatbot.
 * Loads a multilingual sentence-embedding model with transformers.js (ONNX, quantized, runs on WASM in the
 * browser), embeds every FAQ question + variation once, caches those vectors in IndexedDB, and answers
 * "how similar is this question to each FAQ?" — all inside the browser. The user's question never leaves
 * the device; the only network traffic is downloading the model files the first time.
 */
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { SemanticScores } from "./types";

export const MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

export type WorkerIn =
  | { type: "init"; key: string; entries: { id: string; texts: string[] }[] }
  | { type: "query"; reqId: number; text: string };

export type WorkerOut =
  | { type: "progress"; pct: number; stage: "download" | "embed" }
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "scores"; reqId: number; scores: SemanticScores };

const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

// Models come from the Hugging Face hub (no local /models folder in this static site).
env.allowLocalModels = false;
env.useBrowserCache = true;

let extractor: FeatureExtractionPipeline | null = null;
/** id → one normalised vector per text */
let vectors: Map<string, Float32Array[]> | null = null;

/* ---------------- IndexedDB cache for the FAQ embeddings ---------------- */

const DB = "graceflow-help";
const STORE = "embeddings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheGet(key: string): Promise<Record<string, number[][]> | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function cachePut(key: string, value: Record<string, number[][]>) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear(); // keep only the current FAQ version
    tx.objectStore(STORE).put(value, key);
  } catch {
    /* cache is optional */
  }
}

/* ---------------- embedding ---------------- */

async function embed(texts: string[]): Promise<Float32Array[]> {
  const out = await extractor!(texts, { pooling: "mean", normalize: true });
  const [n, dim] = out.dims as [number, number];
  const data = out.data as Float32Array;
  return Array.from({ length: n }, (_, i) => data.slice(i * dim, (i + 1) * dim));
}

function dot(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function init(key: string, entries: { id: string; texts: string[] }[]) {
  const files = new Map<string, { loaded: number; total: number }>();
  extractor = (await pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: "progress", stage: "download", pct: Math.round((loaded / total) * 100) });
    },
  })) as FeatureExtractionPipeline;

  const cached = await cacheGet(key);
  if (cached) {
    vectors = new Map(Object.entries(cached).map(([id, list]) => [id, list.map((v) => Float32Array.from(v))]));
    return;
  }

  vectors = new Map();
  const flat = entries.flatMap((e) => e.texts.map((t) => ({ id: e.id, t })));
  const BATCH = 16;
  for (let i = 0; i < flat.length; i += BATCH) {
    const chunk = flat.slice(i, i + BATCH);
    const vs = await embed(chunk.map((c) => c.t));
    chunk.forEach((c, j) => vectors!.set(c.id, [...(vectors!.get(c.id) ?? []), vs[j]]));
    post({ type: "progress", stage: "embed", pct: Math.round(((i + chunk.length) / flat.length) * 100) });
  }
  await cachePut(key, Object.fromEntries([...vectors].map(([id, list]) => [id, list.map((v) => Array.from(v))])));
}

self.addEventListener("message", async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      await init(msg.key, msg.entries);
      post({ type: "ready" });
    } catch (err) {
      post({ type: "error", message: (err as Error)?.message ?? String(err) });
    }
  } else if (msg.type === "query") {
    const scores: SemanticScores = {};
    try {
      if (extractor && vectors) {
        const [q] = await embed([msg.text]);
        for (const [id, list] of vectors) scores[id] = Math.max(...list.map((v) => dot(q, v)));
      }
    } catch {
      /* empty scores → lexical only */
    }
    post({ type: "scores", reqId: msg.reqId, scores });
  }
});
