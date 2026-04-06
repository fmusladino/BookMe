"use client";

import Script from "next/script";

const GA_MEASUREMENT_ID = process.env["NEXT_PUBLIC_GA_MEASUREMENT_ID"];

/**
 * Componente de Google Analytics 4.
 * Solo se renderiza si existe NEXT_PUBLIC_GA_MEASUREMENT_ID en las env vars.
 *
 * Eventos custom disponibles via gtag():
 *   - booking_completed: cuando un paciente confirma un turno
 *   - professional_registered: cuando un profesional se registra
 *   - directory_search: cuando alguien busca en el directorio
 *   - mia_chat_opened: cuando alguien abre el chat de MIA
 */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_title: document.title,
            send_page_view: true,
          });
        `}
      </Script>
    </>
  );
}

// ─── Funciones helper para trackear eventos custom ───────────────────────

type GtagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent({ action, category, label, value }: GtagEvent) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
}

/** Paciente completó una reserva de turno */
export function trackBookingCompleted(professionalSlug: string, serviceName: string) {
  trackEvent({
    action: "booking_completed",
    category: "appointments",
    label: `${professionalSlug}/${serviceName}`,
  });
}

/** Profesional se registró */
export function trackProfessionalRegistered(line: "healthcare" | "business") {
  trackEvent({
    action: "professional_registered",
    category: "registration",
    label: line,
  });
}

/** Búsqueda en el directorio */
export function trackDirectorySearch(query: string) {
  trackEvent({
    action: "directory_search",
    category: "directory",
    label: query,
  });
}

/** Abrió el chat de MIA */
export function trackMiaChatOpened() {
  trackEvent({
    action: "mia_chat_opened",
    category: "mia",
  });
}

/** Cambió de período en métricas */
export function trackMetricsPeriodChanged(period: string) {
  trackEvent({
    action: "metrics_period_changed",
    category: "metrics",
    label: period,
  });
}
