/**
 * Small tactile/visual feedback helpers (client only).
 *  - haptic(): short vibration on Android; on iOS 18+ Safari uses the native switch-haptic trick.
 *  - ask(): pretty confirm dialog (replaces window.confirm) → Promise<boolean>
 *  - celebrate(): small success burst in the middle of the screen
 */

export type HapticKind = "tap" | "select" | "success" | "warning" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [14, 60, 22],
  warning: [24, 50, 24],
  error: [30, 50, 30, 50, 30],
};

let iosSwitch: HTMLLabelElement | null = null;

function iosTick() {
  // iOS has no Vibration API, but toggling a native <input switch> produces a light haptic (iOS 18+).
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind: HapticKind = "tap") {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches && kind === "tap") return;
    const nav = navigator as Navigator;
    if (typeof nav.vibrate === "function") {
      nav.vibrate(PATTERNS[kind]);
    } else if (/iPhone|iPad|iPod/.test(nav.userAgent)) {
      iosTick();
      if (kind === "success" || kind === "warning" || kind === "error") setTimeout(iosTick, 90);
    }
  } catch {
    /* never let feedback break an action */
  }
}

export type AskOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "primary" | "danger" | "warning";
};

export function ask(opts: AskOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  haptic(opts.tone === "danger" ? "warning" : "select");
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("gf-ask", { detail: { ...opts, resolve } }));
  });
}

/** Success burst + haptic. `message` is shown under the check mark. */
export function celebrate(message?: string) {
  if (typeof window === "undefined") return;
  haptic("success");
  window.dispatchEvent(new CustomEvent("gf-celebrate", { detail: message ?? "" }));
}

/** "Keluar" with a confirmation first. */
export async function confirmLogout(logout: () => unknown) {
  const ok = await ask({
    title: "Keluar dari GraceFlow?",
    message: "Kamu perlu masuk lagi dengan email/username dan kata sandi.",
    confirmText: "Keluar",
    cancelText: "Batal",
    tone: "danger",
  });
  if (ok) await logout();
}
