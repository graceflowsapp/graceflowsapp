"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, cn, inputCls } from "./ui";
import { ask, haptic } from "@/lib/feedback";

const POSITION_SUGGESTIONS = [
  "Worship Leader",
  "Singer",
  "Keyboard",
  "Gitar",
  "Bass",
  "Drum",
  "MC",
  "Pembaca Firman",
  "Doa Syafaat",
  "Usher",
  "Kolektan",
  "Sound System",
  "Operator Slide",
  "Kamera",
  "Live Streaming",
  "Guru Sekolah Minggu",
];

/** Posisi as removable chips (shown above the field) + an input with a "Tambah" button + quick suggestions. */
export function PositionsEditor({
  value,
  onChange,
  original,
  draft,
  setDraft,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  original: string[];
  draft: string;
  setDraft: (v: string) => void;
}) {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const has = (p: string) => value.some((x) => x.toLowerCase() === p.toLowerCase());

  const add = (raw: string) => {
    const names = raw
      .split("\n")
      .map((p) => p.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (!names.length) return;
    const dupes = names.filter(has);
    const fresh = [...new Set(names.filter((p) => !has(p)))];
    if (fresh.length) {
      onChange([...value, ...fresh]);
      haptic("tap");
    }
    setError(dupes.length ? `“${dupes[0]}” sudah ada.` : "");
    setDraft("");
    inputRef.current?.focus();
  };

  const remove = async (p: string) => {
    // removing a posisi that already exists hides its old schedule — make sure that's intended
    if (original.includes(p) && !(await ask({ title: `Hapus posisi “${p}”?`, message: "Jadwal lama untuk posisi ini tidak akan tampil lagi setelah disimpan.", confirmText: "Hapus", tone: "danger" }))) return;
    onChange(value.filter((x) => x !== p));
    haptic("tap");
  };

  const suggestions = POSITION_SUGGESTIONS.filter((p) => !has(p));
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const PREVIEW = 3;
  const shownSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, PREVIEW);
  const hiddenCount = suggestions.length - shownSuggestions.length;

  return (
    <div className="mb-4">
      <span className="block text-sm font-medium text-ink-soft mb-2">
        Posisi / slot <span className="font-normal">({value.length})</span>
      </span>

      {/* added posisi */}
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2 mb-3" aria-label="Posisi yang sudah ditambahkan">
          {value.map((p) => (
            <li key={p} className="inline-flex items-center gap-1 min-h-10 rounded-full bg-brand-soft text-brand border border-brand/30 pl-4 pr-1 text-[15px] font-medium animate-[gf-pop_0.18s_ease-out]">
              {p}
              <button type="button" onClick={() => remove(p)} aria-label={`Hapus ${p}`} className="grid place-items-center h-8 w-8 rounded-full hover:bg-brand/15 active:scale-90 transition">
                <X size={16} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-soft rounded-xl bg-surface px-3 py-2.5 mb-3">Belum ada posisi. Tambahkan di bawah.</p>
      )}

      {/* add one */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className={cn(inputCls, "flex-1 min-w-0 text-[16px]")}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          onPaste={(e) => {
            // pasting a list (one per line) adds them all at once
            const text = e.clipboardData.getData("text");
            if (text.includes("\n")) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder="Nama posisi, mis. Gitar"
          enterKeyHint="done"
          aria-label="Nama posisi baru"
        />
        <Button type="button" onClick={() => add(draft)} disabled={!draft.trim()} className="shrink-0">
          <Plus size={16} /> Tambah
        </Button>
      </div>
      {error ? (
        <p className="text-[13px] text-danger-ink mt-1.5">{error}</p>
      ) : (
        original.length > 0 && <p className="text-[12px] text-ink-soft mt-1.5">Menghapus atau mengganti nama posisi akan memutus jadwal lama untuk posisi tersebut.</p>
      )}

      {/* or just choose */}
      {suggestions.length > 0 && (
        <>
          <span className="block text-[13px] font-medium text-ink-soft mt-3 mb-2">Atau pilih cepat</span>
          <div className="flex flex-wrap gap-2">
            {shownSuggestions.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => add(p)}
                className="inline-flex items-center gap-1 min-h-9 rounded-full border border-dashed border-line bg-card px-3.5 py-1.5 text-[14px] text-ink hover:border-brand hover:text-brand active:scale-[.97] transition"
              >
                <Plus size={14} /> {p}
              </button>
            ))}
            {(hiddenCount > 0 || showAllSuggestions) && suggestions.length > PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllSuggestions((v) => !v)}
                aria-expanded={showAllSuggestions}
                className="inline-flex items-center min-h-9 rounded-full px-3 py-1.5 text-[14px] font-semibold text-brand hover:bg-brand-soft active:scale-[.97] transition"
              >
                {showAllSuggestions ? "Tampilkan lebih sedikit" : `Lihat semua (+${hiddenCount})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
