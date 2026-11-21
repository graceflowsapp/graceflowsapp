"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button, Modal } from "@/components/ui";

/**
 * "Install GraceFlow" prompt.
 * - Android / Chrome / Edge: uses the browser's real install dialog (beforeinstallprompt).
 * - iPhone / iPad Safari: no install API exists, so we show the Share → Add to Home Screen steps.
 * The early `beforeinstallprompt` event is captured by INSTALL_BOOT_SCRIPT (lib/theme-boot.ts) in <head>,
 * because it can fire before React loads.
 */

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __gfInstall?: BIPEvent | null;
  }
}

const DISMISS_KEY = "graceflow-install-dismissed";
const DISMISS_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function useInstall() {
  const [state, setState] = useState({ ready: false, installed: false, canPrompt: false, ios: false });

  useEffect(() => {
    const update = () =>
      setState({ ready: true, installed: isStandalone(), canPrompt: !!window.__gfInstall, ios: isIOS() });
    update();
    const onInstalled = () => {
      window.__gfInstall = null;
      update();
    };
    window.addEventListener("gf-installable", update);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("gf-installable", update);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /** Returns true when the user accepted the native dialog. */
  const promptInstall = async () => {
    const e = window.__gfInstall;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__gfInstall = null;
    setState((s) => ({ ...s, canPrompt: false, installed: outcome === "accepted" || s.installed }));
    return outcome === "accepted";
  };

  return { ...state, available: !state.installed && (state.canPrompt || state.ios), promptInstall };
}

/** Steps for iPhone/iPad, where installing is manual. */
export function IOSInstallSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Pasang GraceFlow di iPhone">
      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-brand-soft text-brand font-bold">1</span>
          <span>
            Buka di <b>Safari</b>, lalu ketuk tombol <b>Bagikan</b> <Share size={15} className="inline -mt-1" /> di bawah layar.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-brand-soft text-brand font-bold">2</span>
          <span>
            Gulir ke bawah, pilih <b>Tambah ke Layar Utama</b> <SquarePlus size={15} className="inline -mt-1" />.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-brand-soft text-brand font-bold">3</span>
          <span>
            Ketuk <b>Tambah</b>. GraceFlow muncul di layar utama seperti aplikasi biasa.
          </span>
        </li>
      </ol>
      <Button className="w-full mt-5" onClick={onClose}>
        Mengerti
      </Button>
    </Modal>
  );
}

/** Bottom banner shown once the app is installable (re-appears 7 days after "Nanti"). */
export function InstallBanner() {
  const { ready, available, canPrompt, ios, promptInstall } = useInstall();
  const [visible, setVisible] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (!ready || !available) return setVisible(false);
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - at < DISMISS_DAYS * 864e5) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setVisible(true), 2500); // let the page settle first
    return () => clearTimeout(t);
  }, [ready, available]);

  // lets other floating UI (the help chat button) move up while the banner is on screen
  useEffect(() => {
    const r = document.documentElement;
    if (visible) r.dataset.installBanner = "";
    else delete r.dataset.installBanner;
    return () => {
      delete r.dataset.installBanner;
    };
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (!ok) dismiss();
      else setVisible(false);
    } else if (ios) setShowIOS(true);
  };

  return (
    <>
      {visible && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-line bg-card shadow-lg p-3 flex items-center gap-3 animate-[gf-up_0.25s_ease-out]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-11 w-11 rounded-full shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">Pasang GraceFlow</div>
              <div className="text-xs text-ink-soft">Buka lebih cepat dari layar utama, seperti aplikasi.</div>
            </div>
            <Button size="sm" className="shrink-0" onClick={install}>
              <Download size={15} /> Pasang
            </Button>
            <button aria-label="Nanti" onClick={dismiss} className="shrink-0 p-1 text-ink-soft hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      <IOSInstallSteps
        open={showIOS}
        onClose={() => {
          setShowIOS(false);
          setVisible(false);
        }}
      />
    </>
  );
}
