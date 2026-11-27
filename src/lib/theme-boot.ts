// Server-safe (no "use client"): imported by the root layout to inline in <head>.
export const THEME_KEY = "graceflow-theme";
export const CHURCH_ACCENT_KEY = "graceflow-church-accent";

/** Page background colours (= --color-surface in globals.css). Used for theme-color so the
 *  Android status bar and navigation bar / gesture pill area blend with the page. */
/** Font scale per text-size setting (sets --fs on <html>, see globals.css). */
export const TEXT_SCALE: Record<string, number> = { sm: 0.9, md: 1, lg: 1.12, xl: 1.25 };

export const SURFACE_LIGHT = "#f4f8f7";
export const SURFACE_DARK = "#0e1615";

/**
 * Inline script for <head>: applies the saved theme before first paint so dark-mode users
 * never see a white flash. Keep in sync with applyTheme().
 */
/** Captures the browser's install event early so the "Pasang GraceFlow" banner can trigger it later. */
export const INSTALL_BOOT_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__gfInstall=e;window.dispatchEvent(new Event("gf-installable"));});`;

export const THEME_BOOT_SCRIPT = `(function(){try{
var p=JSON.parse(localStorage.getItem("${THEME_KEY}")||"{}");var m=p.mode||"system";
var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;r.dataset.theme=d?"dark":"light";
var fs=${JSON.stringify(TEXT_SCALE)}[p.textSize];if(fs)r.style.setProperty("--fs",String(fs));
var a=p.accent||localStorage.getItem("${CHURCH_ACCENT_KEY}");
if(a){r.style.setProperty("--color-brand",a);
r.style.setProperty("--color-brand-dark","color-mix(in oklab, "+a+" 75%, black)");
r.style.setProperty("--color-brand-soft","color-mix(in oklab, "+a+" "+(d?22:14)+"%, var(--color-card))");}
}catch(e){}})();`;
