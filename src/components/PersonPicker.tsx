"use client";

/**
 * Friendly "choose a person" sheet: photos, big names, search, available people first, and a short reason
 * for anyone who isn't a good pick. Opens on top of another modal (z-60) and keeps Escape to itself.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, UserMinus, X } from "lucide-react";
import { Avatar, cn } from "./ui";
import { haptic } from "@/lib/feedback";
import type { UserProfile } from "@/lib/types";
import { tr } from "@/lib/i18n";

export interface PickerPerson {
  user: UserProfile;
  /** Short lines under the name (e.g. "OFF: Sakit", "Sudah di Singer 1") */
  notes?: string[];
  /** true → listed under "Lainnya" and shown dimmed (still selectable) */
  muted?: boolean;
  /** Small tag on the right, e.g. "6× bulan ini" */
  tag?: string;
}

export function PersonPicker({
  open,
  title,
  subtitle,
  people,
  selectedId,
  onPick,
  onClose,
  clearLabel,
  emptyText = tr("Tidak ada orang yang bisa dipilih."),
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  people: PickerPerson[];
  selectedId?: string | null;
  onPick: (userId: string | null) => void;
  onClose: () => void;
  /** Show a first row that clears the choice, with this label */
  clearLabel?: string;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    // Escape closes only this sheet, not the modal underneath
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const { ready, others } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? people.filter((p) => p.user.name.toLowerCase().includes(needle)) : people;
    const byName = (a: PickerPerson, b: PickerPerson) => a.user.name.localeCompare(b.user.name);
    return { ready: list.filter((p) => !p.muted).sort(byName), others: list.filter((p) => p.muted).sort(byName) };
  }, [people, q]);

  if (!open) return null;

  const pick = (id: string | null) => {
    haptic("select");
    onPick(id);
    onClose();
  };

  const row = (p: PickerPerson) => {
    const selected = p.user.id === selectedId;
    return (
      <li key={p.user.id}>
        <button
          type="button"
          onClick={() => pick(p.user.id)}
          aria-pressed={selected}
          className={cn(
            "w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[.99]",
            selected ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-surface",
          )}
        >
          <Avatar name={p.user.name} src={p.user.photoUrl} size={44} className={cn("shrink-0", p.muted && "opacity-55")} />
          <div className="flex-1 min-w-0">
            <div className={cn("text-[length:max(16px,calc(16px*var(--fs)))] font-semibold truncate", p.muted && "text-ink-soft")}>{p.user.name}</div>
            {p.notes?.map((n, i) => (
              <div key={i} className="text-[length:calc(13px*var(--fs))] text-ink-soft leading-snug">
                {n}
              </div>
            ))}
          </div>
          {p.tag && !selected && <span className="text-[length:calc(12px*var(--fs))] text-ink-soft shrink-0">{p.tag}</span>}
          {selected && (
            <span className="h-7 w-7 rounded-full bg-brand text-white grid place-items-center shrink-0" aria-hidden>
              <Check size={16} strokeWidth={3} />
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] animate-[gf-fade_.18s_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl max-h-[85dvh] flex flex-col shadow-xl animate-[gf-sheet_.3s_cubic-bezier(.2,.9,.3,1)] sm:animate-[gf-pop_.22s_ease-out]"
      >
        {/* grab handle (phone) */}
        <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-start gap-3 px-5 pt-3 pb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[length:calc(17px*var(--fs))] font-bold text-ink">{title}</h3>
            {subtitle && <p className="text-[length:calc(13px*var(--fs))] text-ink-soft">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 rounded-xl hover:bg-surface" aria-label={tr("Tutup")}>
            <X size={20} />
          </button>
        </div>

        {people.length > 6 && (
          <div className="px-5 pb-3">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("Cari nama…")}
                aria-label={tr("Cari nama")}
                className="w-full rounded-2xl border border-line bg-surface pl-10 pr-4 py-3 text-[length:max(16px,calc(16px*var(--fs)))] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
        )}

        <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {clearLabel && !q && (
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn(
                "w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface mb-1",
                !selectedId && "bg-surface",
              )}
            >
              <span className="h-11 w-11 rounded-full border-2 border-dashed border-line grid place-items-center text-ink-soft shrink-0">
                <UserMinus size={18} />
              </span>
              <span className="flex-1 text-[length:max(16px,calc(16px*var(--fs)))] font-medium text-ink-soft">{clearLabel}</span>
              {!selectedId && <Check size={18} className="text-ink-soft" aria-hidden />}
            </button>
          )}

          {ready.length > 0 && (
            <>
              {others.length > 0 && <p className="px-3 pt-2 pb-1 text-[length:calc(12px*var(--fs))] font-semibold uppercase tracking-wide text-success">{tr("Tersedia")}</p>}
              <ul className="space-y-0.5">{ready.map(row)}</ul>
            </>
          )}
          {others.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-[length:calc(12px*var(--fs))] font-semibold uppercase tracking-wide text-ink-soft">{tr("Lainnya")}</p>
              <ul className="space-y-0.5">{others.map(row)}</ul>
            </>
          )}
          {ready.length + others.length === 0 && <p className="px-3 py-6 text-center text-[length:calc(14px*var(--fs))] text-ink-soft">{q ? tr("Tidak ada nama “{q}”.", { q }) : emptyText}</p>}
        </div>
      </div>
    </div>
  );
}
