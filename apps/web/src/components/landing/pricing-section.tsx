"use client";

import Link from "next/link";
import { Building2, Star, Check } from "lucide-react";
import { useFeatures } from "@/hooks/use-features";
import { Skeleton } from "@/components/ui/skeleton";

// Datos estáticos de features por plan (labels descriptivos)
const HC_PLANS = [
  {
    key: "base",
    name: "Base",
    features: ["Agenda completa", "Turnos ilimitados", "Recordatorios WhatsApp", "Notas clínicas básicas"],
    highlight: false,
  },
  {
    key: "standard",
    name: "Standard",
    features: ["Todo en Base", "Historia clínica AES-256", "Dashboard financiero", "Push notifications"],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    features: ["Todo en Standard", "MIA asistente IA", "Liquidación obras sociales", "Soporte prioritario"],
    highlight: false,
  },
];

const BIZ_PLANS = [
  {
    key: "base",
    name: "Base",
    features: ["Agenda completa", "Turnos ilimitados", "Recordatorios WhatsApp", "Notas de sesión"],
    highlight: false,
  },
  {
    key: "standard",
    name: "Standard",
    features: ["Todo en Base", "Catálogo de servicios", "Dashboard financiero", "Push notifications"],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    features: ["Todo en Standard", "MIA asistente IA", "Widget Instagram", "Soporte prioritario"],
    highlight: false,
  },
];

const CLINIC_PLANS = [
  {
    key: "small",
    name: "Consultorio Pequeño",
    capacity: "Hasta 10 profesionales",
    features: ["Features Standard para todos", "Panel de administración", "Métricas por profesional", "Soporte prioritario"],
    highlight: false,
  },
  {
    key: "large",
    name: "Consultorio Grande",
    capacity: "11+ profesionales, sin límite",
    features: ["Features Premium para todos", "Onboarding personalizado", "Dashboard multi-profesional", "Soporte dedicado"],
    highlight: true,
  },
];

// Fallback estáticos por si la API no carga
const FALLBACK_PRICES: Record<string, Record<string, Record<string, number>>> = {
  healthcare: { base: { monthly: 9 }, standard: { monthly: 15 }, premium: { monthly: 20 } },
  business: { base: { monthly: 7 }, standard: { monthly: 14 }, premium: { monthly: 25 } },
};

const FALLBACK_CLINIC_PRICES: Record<string, Record<string, number>> = {
  small: { monthly: 79, annual: 854 },
  large: { monthly: 149, annual: 1610 },
};

export function PricingSection() {
  const { data, loading, getPrice, getClinicPrice } = useFeatures();

  // Helper para precio con fallback
  const price = (plan: string, line: string, cycle = "monthly"): string => {
    if (data?.prices) {
      const p = getPrice(plan, line, cycle);
      if (p !== null) return String(p);
    }
    return String(FALLBACK_PRICES[line]?.[plan]?.[cycle] ?? "–");
  };

  const clinicPrice = (plan: string, cycle = "monthly"): string => {
    if (data?.clinicPrices) {
      const p = getClinicPrice(plan, cycle);
      if (p !== null) return String(p);
    }
    return String(FALLBACK_CLINIC_PRICES[plan]?.[cycle] ?? "–");
  };

  // Formato para anual con separador de miles
  const formatAnnual = (val: string) => {
    const n = Number(val);
    if (isNaN(n)) return val;
    return n.toLocaleString("es-AR");
  };

  return (
    <section className="py-20 bg-card">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-heading font-bold text-center text-foreground mb-4">
          Planes y precios
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          Elegí el plan que mejor se adapte a tu práctica. Todos incluyen 30 días de prueba gratis.
        </p>

        {/* ── Healthcare ── */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-semibold">
              Línea Healthcare
            </div>
            <span className="text-sm text-muted-foreground">Profesionales de la salud</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HC_PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-xl border-2 p-6 transition-shadow hover:shadow-lg ${
                  plan.highlight
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 shadow-md"
                    : "border-border bg-background"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                    <Star className="w-3 h-3" /> Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  {loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">USD {price(plan.key, "healthcare")}</span>
                      <span className="text-sm text-muted-foreground">/mes</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Probar 30 días
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ── Business ── */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
              Línea Business
            </div>
            <span className="text-sm text-muted-foreground">Peluqueros, coaches, abogados y más</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BIZ_PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-xl border-2 p-6 transition-shadow hover:shadow-lg ${
                  plan.highlight
                    ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-md"
                    : "border-border bg-background"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                    <Star className="w-3 h-3" /> Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  {loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">USD {price(plan.key, "business")}</span>
                      <span className="text-sm text-muted-foreground">/mes</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Probar 30 días
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ── Consultorio ── */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm font-semibold">
              Planes Consultorio
            </div>
            <span className="text-sm text-muted-foreground">Clínicas y centros médicos — Solo línea Healthcare</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {CLINIC_PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-xl border-2 p-6 transition-shadow hover:shadow-lg ${
                  plan.highlight
                    ? "border-purple-500 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-950/30 shadow-md"
                    : "border-border bg-background"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white">
                    <Star className="w-3 h-3" /> Recomendado
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{plan.capacity}</p>
                <div className="mb-4">
                  {loading ? (
                    <Skeleton className="h-9 w-32" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">USD {clinicPrice(plan.key)}</span>
                      <span className="text-sm text-muted-foreground">/mes</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        o USD {formatAnnual(clinicPrice(plan.key, "annual"))}/año{" "}
                        <span className="text-purple-600 dark:text-purple-400 font-medium">(ahorrás 10%)</span>
                      </p>
                    </>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-purple-500 dark:text-purple-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  Contactar ventas
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
