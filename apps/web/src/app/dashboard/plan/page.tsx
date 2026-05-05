"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useFeatures } from "@/hooks/use-features";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Check,
  Star,
  Loader2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { CancelSubscriptionModal } from "@/components/plan/cancel-subscription-modal";

// ─── Types ──────────────────────────────────────────────────
interface PlanDef {
  key: string;
  name: string;
  features: string[];
  highlight?: boolean;
}

const HC_PLANS: PlanDef[] = [
  {
    key: "base",
    name: "Base",
    features: ["Agenda completa", "Turnos ilimitados", "Recordatorios WhatsApp", "Notas clínicas básicas"],
  },
  {
    key: "standard",
    name: "Standard",
    features: ["Todo en Base", "Notas por paciente", "Dashboard financiero", "Push notifications", "MIA básica"],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    features: ["Todo en Standard", "MIA avanzada + transcripción", "Liquidación obras sociales", "Múltiples sedes", "Soporte prioritario"],
  },
];

// ─── Page ───────────────────────────────────────────────────
export default function PlanPage() {
  const { user, loading: sessionLoading } = useSession();
  const { getPrice, loading: featuresLoading } = useFeatures();
  const { data: rate } = useExchangeRate();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [redirecting, setRedirecting] = useState(false);

  // Feedback después de volver de MP
  useEffect(() => {
    const mp = searchParams.get("mp");
    if (mp === "success") {
      toast.success("Pago procesado. La suscripción se activará en unos segundos.");
      router.replace("/dashboard/plan");
    } else if (mp === "failure" || mp === "cancel") {
      toast.error("El pago no se completó. Podés intentar de nuevo cuando quieras.");
      router.replace("/dashboard/plan");
    }
  }, [searchParams, router]);

  const line = "healthcare" as const;
  const currentPlan = user?.professional?.plan ?? "free";
  const subscriptionStatus = user?.subscription?.status ?? "trialing";
  const daysLeft = user?.subscription?.daysUntilTrialEnd;
  const trialEndsAt = user?.subscription?.trialEndsAt;
  const cancelledAt = user?.subscription?.cancelledAt;
  const subscriptionExpiresAt = user?.subscription?.subscriptionExpiresAt;
  const plans = HC_PLANS;

  // Modal de baja
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [localCancelledAt, setLocalCancelledAt] = useState<string | null>(null);
  const isCancelled = !!(cancelledAt ?? localCancelledAt);
  // Fecha hasta la cual conserva acceso: fin de período pago (si ya pagó) o fin de trial.
  const accessUntil = subscriptionExpiresAt ?? trialEndsAt ?? null;

  // Pre-seleccionar el plan actual si no es free
  useEffect(() => {
    if (currentPlan && currentPlan !== "free" && !selectedPlan) {
      setSelectedPlan(currentPlan);
    }
  }, [currentPlan, selectedPlan]);

  // ─── Helpers ──────────────────────────────────────────────
  const priceFor = (planKey: string): number | null => {
    return getPrice(planKey, line, billingCycle);
  };

  const formatPrice = (planKey: string): string => {
    const p = priceFor(planKey);
    if (p === null) return "–";
    return `USD ${p}`;
  };

  const priceInARS = (planKey: string): string | null => {
    const usd = priceFor(planKey);
    if (usd === null || !rate) return null;
    return Math.round(usd * rate.sell).toLocaleString("es-AR");
  };

  // ─── Handle select plan → redirige a MP ──────────────────
  const handleSelectPlan = async (planKey: string) => {
    if (planKey === currentPlan && subscriptionStatus === "active") return;
    setSelectedPlan(planKey);
    setRedirecting(true);
    try {
      const res = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          billing_cycle: billingCycle,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        const detail = typeof err.detail === "string" ? err.detail : err.detail ? JSON.stringify(err.detail) : null;
        console.error("[create-checkout] error response", err);
        throw new Error(detail ? `${err.error ?? "Error"} — ${detail}` : err.error || "Error al generar el link de pago");
      }

      const data = (await res.json()) as { init_point: string };
      if (!data.init_point) throw new Error("Mercado Pago no devolvió la URL de pago");

      // Redirigir al checkout de Mercado Pago
      window.location.href = data.init_point;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      setRedirecting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────
  if (sessionLoading || featuresLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "professional") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Solo los profesionales pueden gestionar su plan.
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Mi Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Al elegir un plan vas a Mercado Pago para autorizar la suscripción. Se cobra en pesos según la
          cotización oficial del dólar al momento del pago.
        </p>
      </div>

      {/* Estado actual del trial / suscripción */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                subscriptionStatus === "trialing" ? "bg-blue-100 dark:bg-blue-900/50" :
                subscriptionStatus === "active" ? "bg-green-100 dark:bg-green-900/50" :
                "bg-amber-100 dark:bg-amber-900/50"
              }`}>
                {subscriptionStatus === "trialing" ? (
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                ) : subscriptionStatus === "active" ? (
                  <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Plan actual:{" "}
                    <span className="font-bold">
                      {currentPlan === "free" ? "Sin plan" : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                    </span>
                  </span>
                  {subscriptionStatus === "trialing" && (
                    <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300">
                      <Clock className="mr-1 h-3 w-3" />
                      Trial
                    </Badge>
                  )}
                  {subscriptionStatus === "active" && (
                    <Badge variant="outline" className="border-green-300 text-green-700 dark:border-green-600 dark:text-green-300">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Activo
                    </Badge>
                  )}
                </div>
                {subscriptionStatus === "trialing" && daysLeft != null && (
                  <p className={`text-sm mt-0.5 ${
                    daysLeft <= 5 ? "text-red-600 dark:text-red-400 font-medium" :
                    daysLeft <= 10 ? "text-amber-600 dark:text-amber-400" :
                    "text-muted-foreground"
                  }`}>
                    {daysLeft > 0 ? (
                      <>
                        <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                        Te quedan {daysLeft} {daysLeft === 1 ? "día" : "días"} de prueba gratis
                        {trialEndsAt && (
                          <span className="text-xs opacity-70">
                            {" "}(vence el {new Date(trialEndsAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                        Tu período de prueba venció. Elegí un plan para seguir usando BookMe.
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Healthcare
              </span>
              {/* Botón dar de baja — solo para suscripciones pagas activas (no en trial) */}
              {!isCancelled &&
                currentPlan !== "free" &&
                subscriptionStatus === "active" && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs text-muted-foreground hover:text-red-600 underline underline-offset-2 transition-colors"
                  >
                    Dar de baja
                  </button>
                )}
            </div>
          </div>

          {/* Banner de baja programada */}
          {isCancelled && accessUntil && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
              <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-amber-900 dark:text-amber-200">
                <p className="font-medium">Tu suscripción se dará de baja</p>
                <p className="text-xs mt-0.5">
                  Conservás acceso completo hasta el{" "}
                  <strong>
                    {new Date(accessUntil).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                  . Después de esa fecha tu cuenta pasa a modo solo lectura.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CancelSubscriptionModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        accessUntil={accessUntil}
        onCancelled={(until) => setLocalCancelledAt(new Date().toISOString())}
      />

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
            billingCycle === "monthly"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Mensual
        </button>
        <button
          onClick={() => setBillingCycle("annual")}
          className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
            billingCycle === "annual"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Anual
          <span className="ml-1.5 rounded-full bg-green-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
            -10%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrentPlan = plan.key === currentPlan;
          const price = priceFor(plan.key);
          const colorAccent = "blue";

          return (
            <Card
              key={plan.key}
              className={`relative transition-all hover:shadow-lg cursor-pointer ${
                plan.highlight
                  ? `border-2 border-${colorAccent}-500 dark:border-${colorAccent}-400 shadow-md`
                  : selectedPlan === plan.key
                    ? "border-2 border-primary shadow-md"
                    : "border"
              } ${isCurrentPlan && subscriptionStatus === "active" ? "opacity-80" : ""}`}
              onClick={() => handleSelectPlan(plan.key)}
            >
              {plan.highlight && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-${colorAccent}-600 px-3 py-1 text-xs font-bold text-white`}>
                  <Star className="w-3 h-3" /> Recomendado
                </div>
              )}

              {isCurrentPlan && subscriptionStatus === "active" && (
                <div className="absolute -top-3 right-4 flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
                  <Check className="w-3 h-3" /> Plan actual
                </div>
              )}

              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">
                    {price !== null ? `USD ${price}` : "–"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    /{billingCycle === "monthly" ? "mes" : "año"}
                  </span>
                  {priceInARS(plan.key) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ $ {priceInARS(plan.key)} ARS/{billingCycle === "monthly" ? "mes" : "año"}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-blue-500 dark:text-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full mt-5"
                  variant={plan.highlight ? "default" : "outline"}
                  disabled={(isCurrentPlan && subscriptionStatus === "active") || redirecting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.key);
                  }}
                >
                  {redirecting && selectedPlan === plan.key && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isCurrentPlan && subscriptionStatus === "active"
                    ? "Plan actual"
                    : redirecting && selectedPlan === plan.key
                      ? "Redirigiendo a Mercado Pago…"
                      : isCurrentPlan && subscriptionStatus === "trialing"
                        ? "Pagar con Mercado Pago"
                        : "Elegir plan"
                  }
                  {!redirecting && !(isCurrentPlan && subscriptionStatus === "active") && (
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Disclaimer de cotización */}
      {rate && (
        <p className="text-center text-xs text-muted-foreground mt-2">
          Cotización usada: {rate.name} · venta ${rate.sell.toLocaleString("es-AR")} ·
          actualizada {new Date(rate.updatedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}.
          El monto exacto se fija al crear la suscripción en Mercado Pago.
        </p>
      )}

    </div>
  );
}
