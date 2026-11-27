"use client";

import { Search, X } from "lucide-react";
import { cn, inputCls } from "./ui";
import { tr } from "@/lib/i18n";

/** Name search box with a clear (X) button. */
export function SearchField({
  value,
  onChange,
  placeholder = tr("Cari nama…"),
  autoFocus,
  onClear,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Called by the X button; defaults to emptying the field */
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Escape clears the search instead of closing the popup underneath
          if (e.key === "Escape" && (value || onClear)) {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            (onClear ?? (() => onChange("")))();
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        aria-label={placeholder}
        className={cn(inputCls, "pl-10 pr-10 text-[length:max(16px,calc(16px*var(--fs)))] [&::-webkit-search-cancel-button]:hidden")}
      />
      {(value || onClear) && (
        <button
          type="button"
          onClick={() => (onClear ?? (() => onChange("")))()}
          aria-label={tr("Hapus pencarian")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-lg text-ink-soft hover:bg-surface"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** Case-insensitive name match; empty query matches everyone. */
export function matchesName(name: string, q: string) {
  const needle = q.trim().toLowerCase();
  return !needle || name.toLowerCase().includes(needle);
}
