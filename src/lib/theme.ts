"use client";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemePrefs {
  mode: ThemeMode;
  /** null = default teal palette */
  accent: string | null;
}

import { CHURCH_ACCENT_KEY, THEME_KEY } from "./theme-boot";

export { THEME_KEY };
export const DEFAULT_THEME: ThemePrefs = { mode: "system", accent: null };

export const ACCENT_PRESETS = [
  { name: "Teal (default)", value: null },
  { name: "Biru", value: "#2563eb" },
  { name: "Ungu", value: "#7c3aed" },
  { name: "Rose", value: "#db2777" },
  { name: "Oranye", value: "#ea580c" },
  { name: "Hijau", value: "#15803d" },
  { name: "Slate", value: "#475569" },
] as const;

export function loadTheme(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) return { ...DEFAULT_THEME, ...(JSON.parse(raw) as Partial<ThemePrefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function saveTheme(p: ThemePrefs) {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  applyTheme(p);
  window.dispatchEvent(new CustomEvent("gf-theme", { detail: p }));
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Writes data-theme + accent CSS variables on <html>. Mirrors THEME_BOOT_SCRIPT below. */
let churchAccent: string | null = null;

/** The active church's default accent. Cached so the boot script can apply it before first paint. */
export function setChurchAccent(accent: string | null) {
  churchAccent = accent;
  try {
    if (accent) localStorage.setItem(CHURCH_ACCENT_KEY, accent);
    else localStorage.removeItem(CHURCH_ACCENT_KEY);
  } catch {
    /* ignore */
  }
  applyTheme(loadTheme());
}

export function applyTheme(p: ThemePrefs) {
  const root = document.documentElement;
  const resolved = resolveMode(p.mode);
  root.dataset.theme = resolved;
  const accent = p.accent ?? churchAccent; // personal choice wins over the church default
  if (accent) {
    root.style.setProperty("--color-brand", accent);
    root.style.setProperty("--color-brand-dark", `color-mix(in oklab, ${accent} 75%, black)`);
    root.style.setProperty("--color-brand-soft", `color-mix(in oklab, ${accent} ${resolved === "dark" ? 22 : 14}%, var(--color-card))`);
  } else {
    root.style.removeProperty("--color-brand");
    root.style.removeProperty("--color-brand-dark");
    root.style.removeProperty("--color-brand-soft");
  }
  // Android status bar: dark surface in dark mode, accent in light mode
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  const color = resolved === "dark" ? "#0e1615" : accent ?? "#0f766e";
  if (metas.length) metas.forEach((m) => m.setAttribute("content", color));
  else {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = color;
    document.head.appendChild(m);
  }
}
