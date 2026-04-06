"use client";

import { useState } from "react";
import { useSession } from "@/hooks/use-session";
import {
  Clock,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

/**
 * SubscriptionBanner — muestra avisos de trial y suscripción.
 *
 * Avisos de vencimiento del trial:
 *  - 5 días antes → amarillo (dismissible)
 *  - 3 días antes → naranja (dismissible)
 *  - Día que vence → rojo (no dismissible)
 *  - Expirado → rojo intenso (no dismissible)
 *
 * Todos los enlaces apuntan a /dashboard/plan para que el profesional
 * elija su plan e ingrese su tarjeta.
 */
export function SubscriptionBanner() {
  const { user, loading } = useSession();
  const [isDismissed, setIsDismissed] = useState(false);

  if (loading || !user || user.role !== "professional" || !user.subscription) {
    return null;
  }

  const { status, daysUntilTrialEnd } = user.subscription;

  // ── Trial activo con avisos ──
  if (status === "trialing" && daysUntilTrialEnd !== null) {
    // Trial expirado
    if (daysUntilTrialEnd <= 0) {
      return <BannerTrialExpired />;
    }

    // Día del vencimiento (hoy vence)
    if (daysUntilTrialEnd === 1) {
      return <BannerTrialToday />;
    }

    // 3 días antes → naranja, más urgente
    if (daysUntilTrialEnd <= 3) {
      return (
        <BannerTrialUrgent
          daysLeft={daysUntilTrialEnd}
          isDismissed={isDismissed}
          onDismiss={() => setIsDismissed(true)}
        />
      );
    }

    // 5 días antes → amarillo suave
    if (daysUntilTrialEnd <= 5) {
      return (
        <BannerTrialExpiring
          daysLeft={daysUntilTrialEnd}
          isDismissed={isDismissed}
          onDismiss={() => setIsDismissed(true)}
        />
      );
    }
  }

  // ── Otros estados de suscripción ──
  if (status === "past_due") return <BannerPastDue />;
  if (status === "read_only") return <BannerReadOnly />;
  if (status === "cancelled") return <BannerCancelled />;

  return null;
}

// ─── 5 días antes: amarillo (dismissible) ─────────────────────────────
function BannerTrialExpiring({
  daysLeft,
  isDismissed,
  onDismiss,
}: {
  daysLeft: number;
  isDismissed: boolean;
  onDismiss: () => void;
}) {
  if (isDismissed) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6 dark:bg-amber-950/30 dark:border-amber-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Tu período de prueba vence en <strong>{daysLeft} {daysLeft === 1 ? "día" : "días"}</strong>.
            Elegí un plan e ingresá tu tarjeta para no perder acceso.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/dashboard/plan"
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Elegir plan
            <ChevronRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onDismiss}
            className="rounded-md p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors text-amber-600 dark:text-amber-400"
            aria-label="Descartar"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 3 días antes: naranja, más urgente (dismissible) ─────────────────
function BannerTrialUrgent({
  daysLeft,
  isDismissed,
  onDismiss,
}: {
  daysLeft: number;
  isDismissed: boolean;
  onDismiss: () => void;
}) {
  if (isDismissed) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-orange-50 border-b border-orange-200 px-4 py-3 sm:px-6 dark:bg-orange-950/30 dark:border-orange-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
            <strong>Quedan solo {daysLeft} {daysLeft === 1 ? "día" : "días"}</strong> de tu período de prueba.
            Si no elegís un plan, perderás acceso a tu agenda y turnos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/dashboard/plan"
            className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Elegir plan ahora
            <ChevronRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onDismiss}
            className="rounded-md p-1.5 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors text-orange-600 dark:text-orange-400"
            aria-label="Descartar"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Día del vencimiento: rojo (NO dismissible) ────────────────────────
function BannerTrialToday() {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-red-50 border-b border-red-200 px-4 py-3 sm:px-6 dark:bg-red-950/30 dark:border-red-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-bold text-red-900 dark:text-red-200">
            Tu período de prueba vence HOY. Elegí un plan e ingresá tu tarjeta para no perder el acceso.
          </p>
        </div>
        <Link
          href="/dashboard/plan"
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors flex-shrink-0"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Elegir plan
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Trial expirado (NO dismissible) ──────────────────────────────────
function BannerTrialExpired() {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-red-50 border-b border-red-200 px-4 py-3 sm:px-6 dark:bg-red-950/30 dark:border-red-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm font-medium text-red-900 dark:text-red-200">
            Tu período de prueba expiró. Elegí un plan para seguir usando BookMe.
          </p>
        </div>
        <Link
          href="/dashboard/plan"
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors flex-shrink-0"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Elegir plan
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Past due: pago pendiente (3 días de gracia) ──────────────────────
function BannerPastDue() {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-orange-50 border-b border-orange-200 px-4 py-3 sm:px-6 dark:bg-orange-950/30 dark:border-orange-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
            Tu suscripción tiene un pago pendiente. Tenés 3 días de gracia para regularizar.
          </p>
        </div>
        <Link
          href="/dashboard/plan"
          className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors flex-shrink-0"
        >
          Regularizar pago
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Read-only: cuenta congelada ──────────────────────────────────────
function BannerReadOnly() {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-red-50 border-b border-red-200 px-4 py-3 sm:px-6 dark:bg-red-950/30 dark:border-red-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm font-medium text-red-900 dark:text-red-200">
            Tu cuenta está en modo solo lectura. Regularizá tu pago para volver a gestionar turnos.
          </p>
        </div>
        <Link
          href="/dashboard/plan"
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors flex-shrink-0"
        >
          Regularizar ahora
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Cancelled: suscripción cancelada ─────────────────────────────────
function BannerCancelled() {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-red-50 border-b border-red-200 px-4 py-3 sm:px-6 dark:bg-red-950/30 dark:border-red-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm font-medium text-red-900 dark:text-red-200">
            Tu suscripción fue cancelada. Reactivá tu plan para seguir usando BookMe.
          </p>
        </div>
        <Link
          href="/dashboard/plan"
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors flex-shrink-0"
        >
          Reactivar
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
