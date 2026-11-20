"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "success" | "secondary" | "ghost" | "danger" | "whatsapp";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark shadow-sm",
        variant === "success" && "bg-success text-white hover:brightness-95 shadow-sm",
        variant === "secondary" && "bg-card text-ink border border-line hover:bg-surface",
        variant === "ghost" && "text-ink-soft hover:bg-surface",
        variant === "danger" && "bg-danger-soft text-danger-ink hover:bg-danger-soft",
        variant === "whatsapp" && "bg-[#25D366] text-white hover:bg-[#1ebe5b] shadow-sm",
        className,
      )}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  // Only apply the default background when the caller doesn't pass its own bg-* class.
  const customBg = /(^|\s)bg-/.test(className ?? "");
  return <div className={cn("rounded-2xl border border-line shadow-[0_1px_2px_rgba(0,0,0,.04)]", !customBg && "bg-card", className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-6 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{children}</h2>
      {action}
    </div>
  );
}

export function Avatar({ name, src, size = 40, className }: { name?: string; src?: string; size?: number; className?: string }) {
  const initials = (name ?? "?")
    .replace(/^(Pdt|Ev|Bpk|Ibu)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const hue = [...(name ?? "")].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      crossOrigin="anonymous"
      className={cn("rounded-full object-cover shrink-0 bg-surface", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={cn("rounded-full shrink-0 grid place-items-center font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 55% 55%)` }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", !color && "bg-surface text-ink-soft", className)}
      style={color ? { background: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 rounded-full transition shrink-0", checked ? "bg-success" : "bg-ink-soft/40")}
    >
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className={cn("w-full bg-card rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col shadow-xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg hover:bg-surface" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-ink-soft mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-soft mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="text-center py-10 px-6">
      <div className="mx-auto mb-3 grid place-items-center h-12 w-12 rounded-2xl bg-surface text-ink-soft">{icon}</div>
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="text-sm text-ink-soft mt-1">{body}</p>}
    </div>
  );
}

/** Fire-and-forget toast: toast("Tersimpan") */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("gf-toast", { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener("gf-toast", on);
    return () => window.removeEventListener("gf-toast", on);
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] rounded-full bg-ink text-card text-sm px-4 py-2 shadow-lg max-w-[90vw] text-center" role="status">
      {msg}
    </div>
  );
}
