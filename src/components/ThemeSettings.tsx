"use client";

import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { Card, cn } from "./ui";
import { ACCENT_PRESETS, DEFAULT_THEME, loadTheme, saveTheme, type ThemeMode, type ThemePrefs } from "@/lib/theme";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
];

export function ThemeSettings() {
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULT_THEME);
  useEffect(() => setPrefs(loadTheme()), []);

  const update = (p: Partial<ThemePrefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    saveTheme(next);
  };
  const isPreset = ACCENT_PRESETS.some((a) => a.value === prefs.accent);

  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-soft mb-2">Mode tampilan</p>
      <div className="grid grid-cols-3 gap-1 bg-surface rounded-xl p-1" role="radiogroup" aria-label="Mode tampilan">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            role="radio"
            aria-checked={prefs.mode === value}
            onClick={() => update({ mode: value })}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition",
              prefs.mode === value ? "bg-card text-brand shadow-sm" : "text-ink-soft",
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-ink-soft mt-5 mb-2">Warna aksen</p>
      <div className="flex flex-wrap gap-2.5">
        {ACCENT_PRESETS.map((a) => {
          const selected = prefs.accent === a.value;
          return (
            <button
              key={a.name}
              onClick={() => update({ accent: a.value })}
              title={a.name}
              aria-label={a.name}
              aria-pressed={selected}
              className={cn("h-9 w-9 rounded-full grid place-items-center ring-offset-2 ring-offset-card transition", selected && "ring-2 ring-ink")}
              style={{ background: a.value ?? "#0f766e" }}
            >
              {selected && <Check size={16} className="text-white" />}
            </button>
          );
        })}
        {/* Custom colour */}
        <label
          title="Warna kustom"
          className={cn(
            "relative h-9 w-9 rounded-full grid place-items-center cursor-pointer ring-offset-2 ring-offset-card border border-line overflow-hidden",
            !isPreset && "ring-2 ring-ink",
          )}
          style={
            !isPreset && prefs.accent
              ? { background: prefs.accent }
              : { background: "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)" }
          }
        >
          {!isPreset ? <Check size={16} className="text-white" /> : <Palette size={15} className="text-white drop-shadow" />}
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={prefs.accent ?? "#0f766e"}
            onChange={(e) => update({ accent: e.target.value })}
            aria-label="Pilih warna kustom"
          />
        </label>
      </div>

      {/* Live preview */}
      <div className="mt-4 rounded-xl border border-line p-3 flex items-center gap-2">
        <span className="rounded-lg bg-brand text-white text-xs font-semibold px-3 py-1.5">Tombol</span>
        <span className="rounded-full bg-brand-soft text-brand text-[11px] font-medium px-2 py-0.5">Label</span>
        <span className="text-brand text-sm font-medium">Tautan</span>
      </div>

      {(prefs.mode !== DEFAULT_THEME.mode || prefs.accent !== DEFAULT_THEME.accent) && (
        <button className="mt-3 text-xs text-ink-soft underline" onClick={() => update(DEFAULT_THEME)}>
          Kembalikan ke default
        </button>
      )}
      <p className="text-[11px] text-ink-soft mt-2">Pengaturan tampilan disimpan di perangkat ini.</p>
    </Card>
  );
}
