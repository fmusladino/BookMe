"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { useFeatures } from "@/hooks/use-features";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CreditCard,
  Check,
  Star,
  Loader2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CalendarDays,
  Sparkles,
  Lock,
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
    features: ["Todo en Base", "Historia clínica AES-256", "Dashboard financiero", "Push notifications", "MIA básica"],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    features: ["Todo en Standard", "MIA avanzada + transcripción", "Liquidación obras sociales", "Múltiples sedes", "Soporte prioritario"],
  },
];

const BIZ_PLANS: PlanDef[] = [
  {
    key: "base",
    name: "Base",
    features: ["Agenda completa", "Turnos ilimitados", "Recordatorios WhatsApp", "Notas de sesión"],
  },
  {
    key: "standard",
    name: "Standard",
    features: ["Todo en Base", "Catálogo de servicios", "Push notifications", "MIA básica", "Reportes y exportación"],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    features: ["Todo en Standard", "MIA avanzada", "WhatsApp propio", "Múltiples sedes", "Soporte prioritario"],
  },
];

// ─── Page ───────────────────────────────────────────────────
export default function PlanPage() {
  const { user, loading: sessionLoading, refresh: refreshSession } = useSession();
  const { getPrice, loading: featuresLoading } = useFeatures();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Card form (mockeado)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  const line = user?.professional?.line ?? "healthcare";
  const currentPlan = user?.professional?.plan ?? "free";
  const subscriptionStatus = user?.subscription?.status ?? "trialing";
  const daysLeft = user?.subscription?.daysUntilTrialEnd;
  const trialEndsAt = user?.subscription?.trialEndsAt;
  const cancelledAt = user?.subscription?.cancelledAt;
  const subscriptionExpiresAt = user?.subscription?.subscriptionExpiresAt;
  const plans = line === "business" ? BIZ_PLANS : HC_PLANS;

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

  const formatCardNumber = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 16);
    return cleaned.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  const isCardValid =
    cardNumber.replace(/\s/g, "").length === 16 &&
    cardExpiry.length === 5 &&
    cardCvc.length >= 3 &&
    cardName.length >= 2;

  // ─── Handle select plan ───────────────────────────────────
  const handleSelectPlan = (planKey: string) => {
    if (planKey === currentPlan && subscriptionStatus === "active") return;
    setSelectedPlan(planKey);
    setShowPaymentForm(true);
  };

  // ─── Handle confirm ───────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedPlan || !isCardValid) return;

    setSaving(true);
    try {
      const res = await fetch("/api/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          billing_cycle: billingCycle,
          // Datos de tarjeta mockeados — no se envían a ningún procesador real
          card_last_four: cardNumber.replace(/\s/g, "").slice(-4),
          card_brand: "visa",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al seleccionar plan");
      }

      toast.success(`Plan ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} activado correctamente`);
      setShowPaymentForm(false);
      refreshSession();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
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
          Elegí el plan que mejor se adapte a tu práctica. Tu tarjeta se cobrará al finalizar el período de prueba.
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
                {subscriptionStatus === "trialing" && daysLeft !== null && (
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
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                line === "healthcare"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
              }`}>
                {line === "healthcare" ? "Healthcare" : "Business"}
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
          const colorAccent = line === "healthcare" ? "blue" : "emerald";

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
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${
                        line === "healthcare"
                          ? "text-blue-500 dark:text-blue-400"
                          : "text-emerald-500 dark:text-emerald-400"
                      }`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full mt-5"
                  variant={plan.highlight ? "default" : "outline"}
                  disabled={isCurrentPlan && subscriptionStatus === "active"}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.key);
                  }}
                >
                  {isCurrentPlan && subscriptionStatus === "active"
                    ? "Plan actual"
                    : isCurrentPlan && subscriptionStatus === "trialing"
                      ? "Confirmar plan"
                      : "Elegir plan"
                  }
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Payment Form (mock) ─── */}
      {showPaymentForm && selectedPlan && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Datos de pago
            </CardTitle>
            <CardDescription>
              Ingresá tu tarjeta de crédito o débito.{" "}
              {subscriptionStatus === "trialing" && daysLeft && daysLeft > 0
                ? `Se cobrará ${formatPrice(selectedPlan)}/${billingCycle === "monthly" ? "mes" : "año"} cuando termine tu trial (en ${daysLeft} días).`
                : `Se cobrará ${formatPrice(selectedPlan)}/${billingCycle === "monthly" ? "mes" : "año"} inmediatamente.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5">Número de tarjeta</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="4242 4242 4242 4242"
                    className="pl-10"
                    maxLength={19}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Vencimiento</label>
                <Input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">CVC</label>
                <Input
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  maxLength={4}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1.5">Nombre en la tarjeta</label>
                <Input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="JUAN PEREZ"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Lock className="h-4 w-4 shrink-0" />
              <span>
                Tu información de pago está protegida con encriptación de nivel bancario.
                No almacenamos los datos completos de tu tarjeta.
              </span>
            </div>

            {/* Resumen */}
            <div className="rounded-lg border border-border bg-background p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} ({billingCycle === "monthly" ? "Mensual" : "Anual"})
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Precio</span>
                <span className="font-bold">{formatPrice(selectedPlan)}/{billingCycle === "monthly" ? "mes" : "año"}</span>
              </div>
              {subscriptionStatus === "trialing" && daysLeft && daysLeft > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Primer cobro</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    <Sparkles className="inline h-3.5 w-3.5 mr-1" />
                    En {daysLeft} días (gratis hasta entonces)
                  </span>
                </div>
              )}
              <hr className="my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span>Hoy pagás</span>
                <span className={subscriptionStatus === "trialing" && daysLeft && daysLeft > 0 ? "text-green-600 dark:text-green-400" : ""}>
                  {subscriptionStatus === "trialing" && daysLeft && daysLeft > 0
                    ? "USD 0 (trial activo)"
                    : formatPrice(selectedPlan)
                  }
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentForm(false)}
                className="flex-1"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1"
                disabled={saving || !isCardValid}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {subscriptionStatus === "trialing" && daysLeft && daysLeft > 0
                  ? "Confirmar plan (cobro diferido)"
                  : "Pagar y activar"
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
