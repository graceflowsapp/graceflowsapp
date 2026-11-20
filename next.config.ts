import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export → plain files in out/, deployed to Firebase Hosting (all data is loaded in the browser).
  output: "export",
  // With output: "export" the build folder IS the site: production builds go to out/ (deployed), dev keeps .next.
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "production" ? "out" : ".next"),
  // Allow opening the dev server from other devices on the local network / Tailscale.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "100.*.*.*"],
};

export default nextConfig;
