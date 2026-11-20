"use client";

import { useEffect } from "react";
import { applyTheme, loadTheme } from "@/lib/theme";

/** Re-applies the theme on mount and follows the OS setting live when mode = "system". */
export function ThemeSync() {
  useEffect(() => {
    applyTheme(loadTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const p = loadTheme();
      if (p.mode === "system") applyTheme(p);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
