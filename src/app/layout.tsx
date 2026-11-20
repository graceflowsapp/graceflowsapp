import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { Toaster } from "@/components/ui";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeSync } from "@/components/ThemeSync";
import { InstallBanner } from "@/components/InstallPrompt";
import { CelebrateHost, ConfirmHost } from "@/components/FeedbackHost";
import { INSTALL_BOOT_SCRIPT, SURFACE_DARK, SURFACE_LIGHT, THEME_BOOT_SCRIPT } from "@/lib/theme-boot";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "GraceFlow",
  description: "Penjadwalan, komunikasi, dan servant care untuk pelayan gereja.",
  applicationName: "GraceFlow",
  appleWebApp: { capable: true, title: "GraceFlow", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  // Android status bar + navigation bar / gesture pill: same colour as the page background.
  // If the user forces light/dark in Profil, applyTheme() overrides both metas to match.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SURFACE_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: SURFACE_DARK },
  ],
  width: "device-width",
  initialScale: 1,
  // App-like feel on phones: no pinch/double-tap zoom, and no auto-zoom when focusing inputs on iOS.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT + INSTALL_BOOT_SCRIPT }} />
      </head>
      <body className={`${jakarta.variable} antialiased`}>
        <AppProvider>
          {children}
          <Toaster />
          <ConfirmHost />
          <CelebrateHost />
        </AppProvider>
        <InstallBanner />
        <ServiceWorkerRegister />
        <ThemeSync />
      </body>
    </html>
  );
}
