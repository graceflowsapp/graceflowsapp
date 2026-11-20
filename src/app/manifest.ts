import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GraceFlow · Church Ministry",
    short_name: "GraceFlow",
    description: "Jadwal pelayanan, pengganti, dan servant care untuk gereja.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Window colour of the installed app: Chrome also paints it behind the transparent gesture-pill area
    // (and on the splash screen). Static like theme_color, so it can only match one mode → dark.
    background_color: "#0e1615",
    // Chrome Android colours the installed app's bottom navigation bar from this single, static value
    // (it can't follow prefers-color-scheme and alpha is ignored). Dark = matches the page in dark mode.
    theme_color: "#0e1615",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
