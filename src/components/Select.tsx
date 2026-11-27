"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./ui";
import { tr } from "@/lib/i18n";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Second line, e.g. what a role can do */
  description?: string;
  /** Coloured dot (komisi colour) */
  color?: string;
  /** Icon shown in a soft square */
  icon?: ReactNode;
}

const MAX_H = 320;

/**
 * Styled replacement for <select>. The list floats in a portal with fixed position, so it is never clipped by a
 * scrolling Modal; it flips above the button when there is no room below. Keyboard: ↑ ↓ Home End Enter Esc.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
  placeholder,
  className,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < Math.min(MAX_H, 220) && above > below;
    setPos({
      left: r.left,
      width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      maxH: Math.max(160, Math.min(MAX_H, up ? above : below)),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    // capture phase, so Escape closes only the list and not the Modal around it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open) list.current?.querySelectorAll("[role=option]")[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") options[active] && pick(options[active].value);
    else if (e.key === "Tab") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition disabled:opacity-60 disabled:cursor-not-allowed",
          open ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand",
          className,
        )}
      >
        <OptionBody option={current} placeholder={placeholder ?? tr("Pilih…")} />
        <ChevronDown size={18} className={cn("shrink-0 text-ink-soft transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={list}
            role="listbox"
            aria-label={ariaLabel}
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
            className={cn(
              "fixed z-[65] overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-xl",
              pos.top !== undefined ? "origin-top animate-[gf-drop_.18s_ease-out]" : "origin-bottom animate-[gf-fade_.15s_ease-out]",
            )}
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      selected ? "bg-brand-soft" : i === active ? "bg-surface" : "",
                    )}
                  >
                    <OptionBody option={o} strong={selected} />
                    {selected && <Check size={18} className="shrink-0 text-brand" />}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}

function OptionBody<T extends string>({ option, placeholder, strong }: { option?: SelectOption<T>; placeholder?: string; strong?: boolean }) {
  if (!option) return <span className="flex-1 min-w-0 text-ink-soft">{placeholder}</span>;
  return (
    <>
      {option.icon && <span className="h-9 w-9 shrink-0 rounded-xl bg-brand-soft text-brand grid place-items-center">{option.icon}</span>}
      {!option.icon && option.color && <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: option.color }} />}
      <span className="flex-1 min-w-0">
        <span className={cn("block truncate text-[length:calc(15px*var(--fs))]", strong ? "font-semibold" : "font-medium")}>{option.label}</span>
        {option.description && <span className="block text-[length:calc(12px*var(--fs))] text-ink-soft leading-snug">{option.description}</span>}
      </span>
    </>
  );
}
