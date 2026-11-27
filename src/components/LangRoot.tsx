"use client";

import { Fragment, useEffect, useLayoutEffect, useState } from "react";
import { applyLang, savedLang, type Lang } from "@/lib/i18n";

// useLayoutEffect warns during the static pre-render; it only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Renders children in the chosen language. The first render is always Indonesian (matches the pre-rendered
 * HTML); right after mount it switches to the saved language. A change re-mounts the subtree so every
 * `tr()` call runs again.
 */
export function LangRoot({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");
  useIsoLayoutEffect(() => {
    const l = savedLang();
    applyLang(l);
    setLangState(l);
    const on = (e: Event) => setLangState((e as CustomEvent<Lang>).detail);
    window.addEventListener("gf-lang", on);
    return () => window.removeEventListener("gf-lang", on);
  }, []);
  return <Fragment key={lang}>{children}</Fragment>;
}
