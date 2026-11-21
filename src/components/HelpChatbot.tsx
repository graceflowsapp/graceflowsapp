"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, HelpCircle, Loader2, MessageCircleQuestion, RotateCcw, Send, X } from "lucide-react";
import { useApp } from "./providers";
import { cn } from "./ui";
import faqData from "@/data/faq.json";
import type { FaqItem } from "@/lib/chatbot/types";
import { buildIndex, faqRolesFor, match, related } from "@/lib/chatbot/match";
import { getSemanticStatus, onSemanticStatus, semanticScores, startSemantic, type SemanticStatus } from "@/lib/chatbot/semantic";

const ALL_FAQ = faqData as FaqItem[];
const STORAGE_KEY = "graceflow-help-chat";
/** Short "sedang mengetik..." pause so answers don't feel abrupt. */
const TYPING_MS = 550;
/** Shown as buttons in the welcome message (first ones the user's role can see). */
const POPULAR = ["konfirmasi-hadir", "berhalangan", "jadi-pengganti", "status-off-rehat", "lihat-tim", "ganti-foto", "koor-smart-fill", "admin-tambah-ibadah"];

type Msg =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; kind: "welcome" }
  | { id: number; from: "bot"; kind: "answer"; faqId: string }
  | { id: number; from: "bot"; kind: "clarify"; options: string[] }
  | { id: number; from: "bot"; kind: "unknown" }
  | { id: number; from: "bot"; kind: "category"; kategori: string };
/** A message before it gets its id (Omit distributed over the union). */
type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;

function loadHistory(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Msg[]) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: Msg[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-60)));
  } catch {
    /* ignore (private mode / storage full) */
  }
}

export function HelpChatbot() {
  const { me } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sem, setSem] = useState<SemanticStatus>(getSemanticStatus);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // FAQ visible to this user's role
  const roles = faqRolesFor(me?.role, (me?.coordinatorOf.length ?? 0) > 0);
  const roleKey = roles.join(",");
  const items = useMemo(() => ALL_FAQ.filter((f) => roleKey.split(",").includes(f.role)), [roleKey]);
  const index = useMemo(() => buildIndex(items), [items]);
  const byId = useMemo(() => new Map(items.map((f) => [f.id, f])), [items]);
  const categories = useMemo(() => [...new Set(items.filter((f) => f.kategori !== "Sapaan").map((f) => f.kategori))], [items]);
  const popular = useMemo(() => POPULAR.filter((id) => byId.has(id)).slice(0, 5), [byId]);

  // restore this tab's history once
  useEffect(() => {
    const h = loadHistory();
    nextId.current = h.reduce((n, m) => Math.max(n, m.id + 1), 1);
    setMsgs(h);
  }, []);
  useEffect(() => {
    if (msgs.length) saveHistory(msgs);
  }, [msgs]);

  useEffect(() => onSemanticStatus(setSem), []);

  const push = useCallback((m: NewMsg | NewMsg[]) => {
    const list = (Array.isArray(m) ? m : [m]).map((x) => ({ ...x, id: nextId.current++ }) as Msg);
    setMsgs((prev) => [...prev, ...list]);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }, []);

  // first open: welcome message + lazy-load the semantic model
  useEffect(() => {
    if (!open) return;
    if (!msgs.length) push({ from: "bot", kind: "welcome" });
    startSemantic(ALL_FAQ);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, open]);

  const replyLater = (m: NewMsg) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      push(m);
    }, TYPING_MS);
  };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setInput("");
    push({ from: "user", text: q });
    setTyping(true);
    const started = Date.now();
    const semantic = await semanticScores(q);
    const r = match(index, q, semantic);
    const wait = Math.max(0, TYPING_MS - (Date.now() - started));
    setTimeout(() => {
      setTyping(false);
      if (r.kind === "answer") push({ from: "bot", kind: "answer", faqId: r.best.item.id });
      else if (r.kind === "clarify") push({ from: "bot", kind: "clarify", options: r.options.map((o) => o.item.id) });
      else push({ from: "bot", kind: "unknown" });
    }, wait);
  };

  /** A button with a known FAQ: show it as if the user asked that question. */
  const pick = (faqId: string) => {
    const f = byId.get(faqId);
    if (!f || typing) return;
    push({ from: "user", text: f.pertanyaan });
    replyLater({ from: "bot", kind: "answer", faqId });
  };

  const pickCategory = (kategori: string) => {
    if (typing) return;
    push({ from: "user", text: kategori });
    replyLater({ from: "bot", kind: "category", kategori });
  };

  const go = (link: string) => {
    close();
    if (link !== pathname) router.push(link);
  };

  const reset = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setMsgs([]);
    push({ from: "bot", kind: "welcome" });
    inputRef.current?.focus();
  };

  if (!me) return null;

  const chip = "rounded-full border border-brand/40 bg-card text-brand px-3.5 py-2 text-[15px] font-medium text-left hover:bg-brand-soft active:scale-[.98] transition";

  const renderBot = (m: Extract<Msg, { from: "bot" }>) => {
    if (m.kind === "welcome") {
      return (
        <>
          <p>
            Halo, {me.name.split(" ")[0]}! 👋 Saya asisten bantuan GraceFlow. Mau tanya cara memakai aplikasi ini? Ketik pertanyaanmu, atau pilih di bawah:
          </p>
          <p className="mt-3 text-[13px] font-semibold text-ink-soft">Pertanyaan populer</p>
          <div className="mt-1.5 flex flex-col gap-2">
            {popular.map((id) => (
              <button key={id} className={chip} onClick={() => pick(id)}>
                {byId.get(id)!.pertanyaan}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] font-semibold text-ink-soft">Atau pilih topik</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {categories.map((k) => (
              <button key={k} className={cn(chip, "py-1.5 text-[14px]")} onClick={() => pickCategory(k)}>
                {k}
              </button>
            ))}
          </div>
        </>
      );
    }
    if (m.kind === "category") {
      return (
        <>
          <p>Ini pertanyaan tentang “{m.kategori}”. Pilih salah satu:</p>
          <div className="mt-2 flex flex-col gap-2">
            {items
              .filter((f) => f.kategori === m.kategori)
              .map((f) => (
                <button key={f.id} className={chip} onClick={() => pick(f.id)}>
                  {f.pertanyaan}
                </button>
              ))}
          </div>
        </>
      );
    }
    if (m.kind === "clarify") {
      return (
        <>
          <p>Maksudnya yang ini? 🤔</p>
          <div className="mt-2 flex flex-col gap-2">
            {m.options
              .filter((id) => byId.has(id))
              .map((id) => (
                <button key={id} className={chip} onClick={() => pick(id)}>
                  {byId.get(id)!.pertanyaan}
                </button>
              ))}
            <button
              className="text-[14px] text-ink-soft underline text-left px-1 py-1"
              onClick={() => {
                push({ from: "user", text: "Bukan semuanya" });
                replyLater({ from: "bot", kind: "unknown" });
              }}
            >
              Bukan semuanya
            </button>
          </div>
        </>
      );
    }
    if (m.kind === "unknown") {
      return (
        <>
          <p>Maaf, saya belum paham 🙏</p>
          <p className="mt-1">Coba tanyakan dengan kata lain yang lebih singkat, misalnya “cara konfirmasi hadir”. Kalau masih bingung, silakan hubungi sekretariat atau admin gereja.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {popular.slice(0, 3).map((id) => (
              <button key={id} className={chip} onClick={() => pick(id)}>
                {byId.get(id)!.pertanyaan}
              </button>
            ))}
          </div>
        </>
      );
    }
    const f = byId.get(m.faqId);
    if (!f) return <p>Maaf, jawaban ini tidak tersedia untuk akunmu.</p>;
    const more = f.kategori === "Sapaan" ? [] : related(items, f, 3);
    return (
      <>
        <p>{f.jawaban}</p>
        {f.langkah.length > 0 && (
          <ol className="mt-2 space-y-2">
            {f.langkah.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-brand text-white text-[14px] font-bold" aria-hidden>
                  {i + 1}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        )}
        {f.link && (
          <button
            onClick={() => go(f.link!)}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-white px-4 py-3 text-[16px] font-semibold hover:bg-brand-dark active:scale-[.98] transition"
          >
            Bawa saya ke sana <ArrowRight size={18} />
          </button>
        )}
        {more.length > 0 && (
          <>
            <p className="mt-3 text-[13px] font-semibold text-ink-soft">Pertanyaan terkait</p>
            <div className="mt-1.5 flex flex-col gap-2">
              {more.map((r) => (
                <button key={r.id} className={chip} onClick={() => pick(r.id)}>
                  {r.pertanyaan}
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <>
      {!open && (
        <button
          ref={fabRef}
          onClick={() => setOpen(true)}
          aria-label="Buka bantuan: tanya cara memakai aplikasi"
          aria-haspopup="dialog"
          className="fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] md:right-6 md:bottom-6 h-14 w-14 rounded-full bg-brand text-white shadow-lg grid place-items-center hover:bg-brand-dark active:scale-95 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <MessageCircleQuestion size={28} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bantuan GraceFlow"
          className={cn(
            "fixed z-50 flex flex-col bg-surface text-ink shadow-2xl animate-[gf-up_.2s_ease-out]",
            // phone: (almost) full screen; desktop: floating panel bottom-right
            "inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:h-[min(680px,calc(100dvh-3rem))] sm:rounded-3xl sm:border sm:border-line sm:p-0 sm:overflow-hidden",
          )}
        >
          {/* header */}
          <div className="flex items-center gap-3 px-4 h-16 bg-brand text-white shrink-0">
            <HelpCircle size={26} aria-hidden />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[17px] leading-tight">Bantuan</h2>
              <p className="text-[13px] opacity-90 truncate">Tanya cara memakai GraceFlow</p>
            </div>
            <button onClick={reset} className="p-2 rounded-xl hover:bg-white/15" aria-label="Mulai percakapan baru">
              <RotateCcw size={20} />
            </button>
            <button onClick={close} className="p-2 -mr-1 rounded-xl hover:bg-white/15" aria-label="Tutup bantuan">
              <X size={24} />
            </button>
          </div>

          {sem.state === "loading" && (
            <div className="flex items-center gap-2 px-4 py-2 text-[13px] bg-brand-soft text-brand shrink-0" role="status">
              <Loader2 size={15} className="animate-spin shrink-0" />
              <span className="flex-1">
                {sem.stage === "download" ? "Menyiapkan pemahaman bahasa (sekali saja)" : "Mempelajari daftar pertanyaan"}… {sem.pct}%
              </span>
            </div>
          )}

          {/* messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 text-[16px] leading-relaxed" aria-live="polite">
            {msgs.map((m) =>
              m.from === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand text-white px-4 py-2.5 break-words">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="flex">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-card border border-line px-4 py-3 break-words">{renderBot(m)}</div>
                </div>
              ),
            )}
            {typing && (
              <div className="flex" role="status" aria-label="Sedang mengetik">
                <div className="rounded-2xl rounded-bl-md bg-card border border-line px-4 py-3 text-ink-soft text-[15px] flex items-center gap-2">
                  <span className="flex gap-1" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 rounded-full bg-ink-soft animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                  sedang mengetik...
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <form
            className="flex items-center gap-2 p-3 border-t border-line bg-card shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="help-chat-input" className="sr-only">
              Tulis pertanyaan
            </label>
            <input
              id="help-chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pertanyaanmu…"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={200}
              className="flex-1 min-w-0 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Kirim pertanyaan"
              className="h-12 w-12 shrink-0 rounded-xl bg-brand text-white grid place-items-center hover:bg-brand-dark disabled:opacity-40 active:scale-95 transition"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
