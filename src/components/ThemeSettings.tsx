"use client";

import { useEffect, useState } from "react";
import { Check, Languages, Monitor, Moon, Palette, Sun } from "lucide-react";
import { Card, cn } from "./ui";
import { ACCENT_PRESETS, DEFAULT_THEME, TEXT_SIZES, loadTheme, saveTheme, type ThemeMode, type ThemePrefs } from "@/lib/theme";
import { LANGS, getLang, setLang, tr } from "@/lib/i18n";

/** Preview size of the "Aa" sample on each text-size button (fixed, so the buttons themselves don't jump). */
const SAMPLE_PX = { sm: 13, md: 15, lg: 18, xl: 21 } as const;

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
      <p className="text-xs font-medium text-ink-soft mb-2">{tr("Mode tampilan")}</p>
      <div className="grid grid-cols-3 gap-1 bg-surface rounded-xl p-1" role="radiogroup" aria-label={tr("Mode tampilan")}>
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
            <Icon size={15} /> {tr(label)}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-ink-soft mt-5 mb-2">{tr("Ukuran teks")}</p>
      <div className="grid grid-cols-4 gap-1 bg-surface rounded-xl p-1" role="radiogroup" aria-label={tr("Ukuran teks")}>
        {TEXT_SIZES.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={prefs.textSize === value}
            onClick={() => update({ textSize: value })}
            className={cn(
              "flex flex-col items-center justify-end gap-0.5 rounded-lg py-1.5 transition min-w-0",
              prefs.textSize === value ? "bg-card text-brand shadow-sm" : "text-ink-soft",
            )}
          >
            <span className="font-bold leading-none" style={{ fontSize: SAMPLE_PX[value] }} aria-hidden>
              Aa
            </span>
            <span className="text-[length:calc(11px*var(--fs))] font-medium leading-tight text-center">{tr(label)}</span>
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-ink-soft mt-5 mb-2 flex items-center gap-1.5">
        <Languages size={13} /> {tr("Bahasa")}
      </p>
      <div className="grid grid-cols-2 gap-1 bg-surface rounded-xl p-1" role="radiogroup" aria-label={tr("Bahasa")}>
        {LANGS.map(({ value, label }) => (
          <button
            key={value}
            role="radio"
            aria-checked={getLang() === value}
            onClick={() => value !== getLang() && setLang(value)}
            className={cn("rounded-lg py-2 text-sm font-medium transition", getLang() === value ? "bg-card text-brand shadow-sm" : "text-ink-soft")}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-ink-soft mt-5 mb-2">{tr("Warna aksen")}</p>
      <div className="flex flex-wrap gap-2.5">
        {ACCENT_PRESETS.map((a) => {
          const selected = prefs.accent === a.value;
          return (
            <button
              key={a.name}
              onClick={() => update({ accent: a.value })}
              title={tr(a.name)}
              aria-label={tr(a.name)}
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
          title={tr("Warna kustom")}
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
            aria-label={tr("Pilih warna kustom")}
          />
        </label>
      </div>

      {/* Live preview */}
      <div className="mt-4 rounded-xl border border-line p-3 flex items-center gap-2">
        <span className="rounded-lg bg-brand text-white text-xs font-semibold px-3 py-1.5">{tr("Tombol")}</span>
        <span className="rounded-full bg-brand-soft text-brand text-[length:calc(11px*var(--fs))] font-medium px-2 py-0.5">{tr("Label")}</span>
        <span className="text-brand text-sm font-medium">{tr("Tautan")}</span>
      </div>

      {(prefs.mode !== DEFAULT_THEME.mode || prefs.accent !== DEFAULT_THEME.accent || prefs.textSize !== DEFAULT_THEME.textSize) && (
        <button className="mt-3 text-xs text-ink-soft underline" onClick={() => update(DEFAULT_THEME)}>
          {tr("Kembalikan ke default")}
        </button>
      )}
      <p className="text-[length:calc(11px*var(--fs))] text-ink-soft mt-2">{tr("Pengaturan tampilan disimpan di perangkat ini.")}</p>
    </Card>
  );
}
