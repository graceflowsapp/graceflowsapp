/**
 * Tiny i18n: the Indonesian text in the code IS the key. `tr("Simpan")` returns "Save" in English and
 * "Simpan" in Indonesian. Placeholders use {name}: tr("Cari di {komisi}…", { komisi }).
 * Missing English entries fall back to the Indonesian text, so nothing ever shows a raw key.
 * Same Indonesian word, different English? Add a context suffix: tr("Komisi@@label") shows "Komisi" in Indonesian.
 *
 * The language is a per-device setting (Profil → Tampilan). Switching re-mounts the UI (LangRoot), so
 * `tr()` is a plain function that also works outside React (toasts, error messages, dates).
 */
import { EN } from "./i18n-en";

export type Lang = "id" | "en";
export const LANG_KEY = "graceflow-lang";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
];

// Always "id" for the first (hydration) render so it matches the pre-rendered HTML; LangRoot switches after mount.
let lang: Lang = "id";
const missing = new Set<string>();

export function getLang(): Lang {
  return lang;
}

export function savedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

/** Used by LangRoot only. */
export function applyLang(l: Lang) {
  lang = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* ignore */
  }
  applyLang(l);
  window.dispatchEvent(new CustomEvent("gf-lang", { detail: l }));
}

type Params = Record<string, string | number | null | undefined>;

export function tr(text: string, params?: Params): string {
  return trIn(lang, text, params);
}

export function trIn(l: Lang, text: string, params?: Params): string {
  let out = text;
  if (l === "en") {
    const hit = EN[text];
    if (hit !== undefined) out = hit;
    else if (process.env.NODE_ENV !== "production" && !missing.has(text)) {
      missing.add(text);
      console.warn("[i18n] missing English:", JSON.stringify(text));
    }
  }
  const ctx = out.indexOf("@@");
  if (ctx >= 0) out = out.slice(0, ctx);
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k] ?? "") : m));
  return out;
}

/** BCP-47 locale for dates/numbers. */
export function locale() {
  return lang === "en" ? "en-GB" : "id-ID";
}

/* ---------- Messages stored for someone else (notifications) ---------- */

/** A translatable message: the Indonesian key + its values, translated when the READER shows it. */
export interface Msg {
  k: string;
  p?: Record<string, string>;
}

export function nm(k: string, params?: Params): Msg {
  if (!params) return { k };
  return { k, p: Object.fromEntries(Object.entries(params).map(([key, v]) => [key, String(v ?? "")])) };
}

/** Text of a stored message in the current language (falls back to the stored Indonesian text). */
export function showMsg(m: Msg | undefined, fallback: string): string {
  return m?.k ? tr(m.k, m.p) : fallback;
}
