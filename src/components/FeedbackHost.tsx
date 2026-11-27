"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, HelpCircle, Trash2 } from "lucide-react";
import type { AskOptions } from "@/lib/feedback";
import { haptic } from "@/lib/feedback";
import { Button, cn } from "@/components/ui";
import { tr } from "@/lib/i18n";

type AskRequest = AskOptions & { resolve: (ok: boolean) => void };

/** Renders the pretty confirm dialog requested by ask(). */
export function ConfirmHost() {
  const [req, setReq] = useState<AskRequest | null>(null);
  const [closing, setClosing] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      setClosing(false);
      setReq((e as CustomEvent<AskRequest>).detail);
    };
    window.addEventListener("gf-ask", on);
    return () => window.removeEventListener("gf-ask", on);
  }, []);

  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter") finish(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  const finish = (ok: boolean) => {
    if (!req || closing) return;
    if (!ok) haptic("tap");
    setClosing(true);
    const r = req;
    setTimeout(() => {
      setReq(null);
      r.resolve(ok);
    }, 160);
  };

  if (!req) return null;
  const tone = req.tone ?? "primary";
  const Icon = tone === "danger" ? Trash2 : tone === "warning" ? AlertTriangle : HelpCircle;

  return (
    <div
      className={cn("fixed inset-0 z-[70] grid place-items-center p-6 bg-black/45 backdrop-blur-[3px]", closing ? "animate-[gf-fade-out_.16s_ease-in_forwards]" : "animate-[gf-fade_.18s_ease-out]")}
      onClick={() => finish(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={req.title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-[340px] rounded-3xl bg-card shadow-2xl p-5 pt-6 text-center",
          closing ? "animate-[gf-pop-out_.16s_ease-in_forwards]" : "animate-[gf-pop_.26s_cubic-bezier(.2,.9,.3,1.25)]",
        )}
      >
        <div
          className={cn(
            "mx-auto mb-3 grid place-items-center h-12 w-12 rounded-2xl",
            tone === "danger" && "bg-danger-soft text-danger-ink",
            tone === "warning" && "bg-warning-soft text-warning-ink",
            tone === "primary" && "bg-brand-soft text-brand",
          )}
        >
          <Icon size={22} />
        </div>
        <h3 className="font-semibold text-ink text-[length:calc(17px*var(--fs))] leading-snug">{req.title}</h3>
        {req.message && <p className="text-sm text-ink-soft mt-1.5 leading-relaxed whitespace-pre-line">{req.message}</p>}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="secondary" onClick={() => finish(false)}>
            {req.cancelText ?? tr("Batal")}
          </Button>
          <Button
            ref={okRef}
            variant={tone === "danger" ? "dangerSolid" : tone === "warning" ? "warningSolid" : "primary"}
            onClick={() => finish(true)}
          >
            {req.confirmText ?? tr("Ya, lanjut")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small "berhasil" burst: check mark that pops, a ring, and a few dots flying out. */
export function CelebrateHost() {
  const [burst, setBurst] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      clearTimeout(t);
      setBurst({ id: Date.now(), message: (e as CustomEvent<string>).detail });
      t = setTimeout(() => setBurst(null), 1300);
    };
    window.addEventListener("gf-celebrate", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("gf-celebrate", on);
    };
  }, []);

  if (!burst) return null;
  const DOTS = 10;
  return (
    <div key={burst.id} className="pointer-events-none fixed inset-0 z-[80] grid place-items-center" aria-hidden="true">
      <div className="relative flex flex-col items-center animate-[gf-celebrate-out_1.3s_ease-in_forwards]">
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 rounded-full border-4 border-success/60 animate-[gf-ring_.7s_ease-out_forwards]" />
          {Array.from({ length: DOTS }, (_, i) => {
            const angle = (360 / DOTS) * i;
            const color = ["var(--color-success)", "var(--color-brand)", "var(--color-warning)"][i % 3];
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-2 w-2 -ml-1 -mt-1 rounded-full animate-[gf-dot_.75s_cubic-bezier(.15,.8,.3,1)_forwards]"
                style={{ background: color, ["--a" as string]: `${angle}deg` }}
              />
            );
          })}
          <div className="absolute inset-0 grid place-items-center rounded-full bg-success text-white shadow-lg animate-[gf-pop_.42s_cubic-bezier(.2,.9,.3,1.4)]">
            <Check size={40} strokeWidth={3} className="animate-[gf-draw_.35s_.12s_ease-out_both]" />
          </div>
        </div>
        {burst.message && (
          <div className="mt-3 rounded-full bg-card/95 backdrop-blur px-4 py-1.5 text-sm font-semibold text-ink shadow-md animate-[gf-up_.3s_.1s_ease-out_both]">
            {burst.message}
          </div>
        )}
      </div>
    </div>
  );
}
