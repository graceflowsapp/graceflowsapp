import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { Toaster } from "@/components/ui";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeSync } from "@/components/ThemeSync";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-boot";

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
  // theme-color (Android status bar) is owned by THEME_BOOT_SCRIPT / applyTheme so it follows light/dark/accent.
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
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${jakarta.variable} antialiased`}>
        <AppProvider>
          {children}
          <Toaster />
        </AppProvider>
        <ServiceWorkerRegister />
        <ThemeSync />
      </body>
    </html>
  );
}
