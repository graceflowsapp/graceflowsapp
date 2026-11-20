// Server-safe (no "use client"): imported by the root layout to inline in <head>.
export const THEME_KEY = "graceflow-theme";
export const CHURCH_ACCENT_KEY = "graceflow-church-accent";

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
var a=p.accent||localStorage.getItem("${CHURCH_ACCENT_KEY}");
if(a){r.style.setProperty("--color-brand",a);
r.style.setProperty("--color-brand-dark","color-mix(in oklab, "+a+" 75%, black)");
r.style.setProperty("--color-brand-soft","color-mix(in oklab, "+a+" "+(d?22:14)+"%, var(--color-card))");}
var t=document.createElement("meta");t.name="theme-color";t.content=d?"#0e1615":"#f4f8f7";document.head.appendChild(t);
}catch(e){}})();`;
