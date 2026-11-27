"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore, isFirebaseConfigured } from "./firebase";
import type { CollectionName } from "./types";
import { buildSeed } from "./seed";
import { tr } from "./i18n";

type Doc = { id: string } & Record<string, unknown>;
export type Filter = { field: string; value: unknown };

/**
 * Path-based data access, implemented by Firestore and by a localStorage demo store.
 * Paths look like "churches/gia/services" (collection) or "churches/gia/services/abc" (document).
 */
export interface Raw {
  subscribeCol<T>(colPath: string, cb: (items: T[]) => void, filter?: Filter): () => void;
  subscribeDoc<T>(docPath: string, cb: (item: T | null) => void): () => void;
  get<T>(docPath: string): Promise<T | null>;
  set(docPath: string, data: object): Promise<void>;
  update(docPath: string, data: object): Promise<void>;
  remove(docPath: string): Promise<void>;
  setMany(colPath: string, items: Doc[]): Promise<void>;
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const parentPath = (path: string) => path.slice(0, path.lastIndexOf("/"));

/* ---------------- Firestore ---------------- */

const firestoreRaw: Raw = {
  subscribeCol(colPath, cb, filter) {
    const ref = collection(firestore(), colPath);
    const q = filter ? query(ref, where(filter.field, "==", filter.value)) : ref;
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as never)),
      (err) => {
        // e.g. permission-denied after being removed from a church — surface as "no data", not a hang
        console.error(`[firestore] ${colPath}:`, err.message);
        cb([]);
      },
    );
  },
  subscribeDoc(docPath, cb) {
    return onSnapshot(
      doc(firestore(), docPath),
      (snap) => cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as never) : null),
      (err) => {
        console.error(`[firestore] ${docPath}:`, err.message);
        cb(null);
      },
    );
  },
  async get(docPath) {
    const snap = await getDoc(doc(firestore(), docPath));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as never) : null;
  },
  async set(docPath, data) {
    await setDoc(doc(firestore(), docPath), { ...data, id: lastSegment(docPath) });
  },
  async update(docPath, data) {
    await updateDoc(doc(firestore(), docPath), data as Record<string, unknown>);
  },
  async remove(docPath) {
    await deleteDoc(doc(firestore(), docPath));
  },
  async setMany(colPath, items) {
    for (let i = 0; i < items.length; i += 450) {
      const batch = writeBatch(firestore());
      for (const item of items.slice(i, i + 450)) batch.set(doc(firestore(), colPath, item.id), item);
      await batch.commit();
    }
  },
};

/* ---------------- Demo (localStorage) ---------------- */

const STORAGE_KEY = "graceflow-demo-v4";
/** collection path -> id -> doc */
export type DemoDB = Record<string, Record<string, Doc>>;

let memory: DemoDB | null = null;
const listeners = new Set<() => void>();

function load(): DemoDB {
  if (memory) return memory;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) memory = JSON.parse(stored) as DemoDB;
  } catch {
    /* ignore */
  }
  if (!memory) {
    memory = buildSeed();
    persist();
  }
  return memory;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* quota or private mode — keep in memory */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      memory = null;
      listeners.forEach((l) => l());
    }
  });
}

export function resetDemoData() {
  memory = buildSeed();
  persist();
}

const localRaw: Raw = {
  subscribeCol(colPath, cb, filter) {
    const emit = () => {
      let items = Object.values(load()[colPath] ?? {});
      if (filter) items = items.filter((d) => d[filter.field] === filter.value);
      cb(structuredClone(items) as never);
    };
    listeners.add(emit);
    queueMicrotask(emit);
    return () => listeners.delete(emit);
  },
  subscribeDoc(docPath, cb) {
    const emit = () => {
      const d = load()[parentPath(docPath)]?.[lastSegment(docPath)];
      cb(d ? (structuredClone(d) as never) : null);
    };
    listeners.add(emit);
    queueMicrotask(emit);
    return () => listeners.delete(emit);
  },
  async get(docPath) {
    const d = load()[parentPath(docPath)]?.[lastSegment(docPath)];
    return d ? (structuredClone(d) as never) : null;
  },
  async set(docPath, data) {
    const db = load();
    const col = parentPath(docPath);
    db[col] ??= {};
    db[col][lastSegment(docPath)] = { ...(data as Record<string, unknown>), id: lastSegment(docPath) };
    persist();
  },
  async update(docPath, data) {
    const db = load();
    const col = parentPath(docPath);
    const cur = db[col]?.[lastSegment(docPath)];
    if (!cur) throw new Error(`${docPath} not found`);
    db[col][lastSegment(docPath)] = { ...cur, ...(data as Record<string, unknown>) };
    persist();
  },
  async remove(docPath) {
    delete load()[parentPath(docPath)]?.[lastSegment(docPath)];
    persist();
  },
  async setMany(colPath, items) {
    const db = load();
    db[colPath] ??= {};
    for (const item of items) db[colPath][item.id] = item;
    persist();
  },
};

export const raw: Raw = isFirebaseConfigured ? firestoreRaw : localRaw;

/* ---------------- Church-scoped store ---------------- */

/** Maps the app's collection names to the per-church sub-collections. */
const SUB: Record<CollectionName, string> = {
  users: "members",
  ministries: "ministries",
  services: "services",
  assignments: "assignments",
  notifications: "notifications",
};

let scope: string | null = null;

/** Set by AppProvider whenever the active church changes. */
export function setChurchScope(churchId: string | null) {
  scope = churchId;
}

export function churchPath(col: CollectionName, churchId = scope) {
  if (!churchId) throw new Error(tr("Belum memilih gereja"));
  return `churches/${churchId}/${SUB[col]}`;
}

/** Same API as before, but everything is automatically inside the active church. */
export interface Store {
  subscribe<T>(col: CollectionName, cb: (items: T[]) => void, filter?: Filter): () => void;
  set(col: CollectionName, id: string, data: object): Promise<void>;
  update(col: CollectionName, id: string, data: object): Promise<void>;
  remove(col: CollectionName, id: string): Promise<void>;
  setMany(col: CollectionName, items: Doc[]): Promise<void>;
}

export const store: Store = {
  subscribe: (col, cb, filter) => raw.subscribeCol(churchPath(col), cb, filter),
  set: (col, id, data) => raw.set(`${churchPath(col)}/${id}`, data),
  update: (col, id, data) => raw.update(`${churchPath(col)}/${id}`, data),
  remove: (col, id) => raw.remove(`${churchPath(col)}/${id}`),
  setMany: (col, items) => raw.setMany(churchPath(col), items),
};
