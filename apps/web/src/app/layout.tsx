// Forzar rendering dinámico en toda la app — evita errores de pre-render
// cuando las páginas necesitan cookies, Supabase u otros datos del servidor
export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { FeaturesProvider } from "@/components/providers/features-provider";
import { MiaFabWrapper } from "@/components/mia/mia-fab-wrapper";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

const fontHeading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const fontBody = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BookMe — Gestioná tu agenda",
    template: "%s | BookMe",
  },
  description:
    "La plataforma de gestión de turnos para profesionales y negocios en LATAM. Agenda, recordatorios, historia clínica y más.",
  keywords: ["turnos", "agenda", "médicos", "profesionales", "LATAM"],
  authors: [{ name: "BookMe", url: "https://bookme.ar" }],
  creator: "BookMe",
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_APP_URL"] ?? "https://bookme.ar"
  ),
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://bookme.ar",
    siteName: "BookMe",
    title: "BookMe — Gestioná tu agenda",
    description: "Gestión de turnos para profesionales en LATAM",
  },
  twitter: {
    card: "summary_large_image",
    title: "BookMe — Gestioná tu agenda",
    description: "Gestión de turnos para profesionales en LATAM",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F2A47" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1628" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <GoogleAnalytics />
        {/* iOS PWA meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BookMe" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Splash screens iOS */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${fontHeading.variable} ${fontBody.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <FeaturesProvider>
              {children}
              <MiaFabWrapper />
              <InstallPrompt />
            </FeaturesProvider>
          </SessionProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
