import type { SubscriptionPlan, LineOfBusiness } from "@/types";

// Mapa de features habilitadas por plan y línea de negocio.
// true = habilitado, false = no disponible en ese plan.

type FeatureKey =
  | "mia_basic"
  | "mia_advanced"
  | "mia_transcription"
  | "push_notifications"
  | "dashboard_financial"
  | "insurance_billing"
  | "afip_billing"
  | "service_catalog"
  | "reports_export"
  | "multiple_locations"
  | "whatsapp_own_number"
  | "qr_custom"
  | (string & {}); // Permite keys dinámicas de la DB

type FeatureMatrix = Record<SubscriptionPlan, Record<string, boolean>>;

// ─── Fallback hardcoded (se usa si no hay datos en DB) ──────

const HEALTHCARE_FEATURES: FeatureMatrix = {
  free: {
    mia_basic: false, mia_advanced: false, mia_transcription: false,
    push_notifications: false, dashboard_financial: false, insurance_billing: false,
    afip_billing: false, service_catalog: false, reports_export: false,
    multiple_locations: false, whatsapp_own_number: false, qr_custom: false,
  },
  base: {
    mia_basic: false, mia_advanced: false, mia_transcription: false,
    push_notifications: false, dashboard_financial: false, insurance_billing: false,
    afip_billing: false, service_catalog: false, reports_export: false,
    multiple_locations: false, whatsapp_own_number: false, qr_custom: false,
  },
  standard: {
    mia_basic: true, mia_advanced: true, mia_transcription: false,
    push_notifications: true, dashboard_financial: true, insurance_billing: true,
    afip_billing: true, service_catalog: true, reports_export: true,
    multiple_locations: false, whatsapp_own_number: false, qr_custom: true,
  },
  premium: {
    mia_basic: true, mia_advanced: true, mia_transcription: true,
    push_notifications: true, dashboard_financial: true, insurance_billing: true,
    afip_billing: true, service_catalog: true, reports_export: true,
    multiple_locations: true, whatsapp_own_number: true, qr_custom: true,
  },
};

const BUSINESS_FEATURES: FeatureMatrix = {
  free: {
    mia_basic: false, mia_advanced: false, mia_transcription: false,
    push_notifications: false, dashboard_financial: false, insurance_billing: false,
    afip_billing: false, service_catalog: false, reports_export: false,
    multiple_locations: false, whatsapp_own_number: false, qr_custom: false,
  },
  base: {
    mia_basic: false, mia_advanced: false, mia_transcription: false,
    push_notifications: false, dashboard_financial: false, insurance_billing: false,
    afip_billing: false, service_catalog: false, reports_export: false,
    multiple_locations: false, whatsapp_own_number: false, qr_custom: false,
  },
  standard: {
    mia_basic: true, mia_advanced: true, mia_transcription: false,
    push_notifications: true, dashboard_financial: false, insurance_billing: false,
    afip_billing: false, service_catalog: true, reports_export: true,
    multiple_locations: false, whatsapp_own_number: false, qr_custom: true,
  },
  premium: {
    mia_basic: true, mia_advanced: true, mia_transcription: false,
    push_notifications: true, dashboard_financial: false, insurance_billing: false,
    afip_billing: false, service_catalog: true, reports_export: true,
    multiple_locations: true, whatsapp_own_number: true, qr_custom: true,
  },
};

const FALLBACK_MATRICES: Record<LineOfBusiness, FeatureMatrix> = {
  healthcare: HEALTHCARE_FEATURES,
  business: BUSINESS_FEATURES,
};

// ─── Cache para features cargadas desde DB ──────────────────

interface CachedFeatures {
  data: Record<LineOfBusiness, FeatureMatrix> | null;
  loadedAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let cache: CachedFeatures = { data: null, loadedAt: 0 };

/**
 * Carga la matriz de features desde la DB vía plan_features.
 * Usa cache en memoria para evitar queries repetidas.
 * Si falla, retorna null y se usa el fallback hardcoded.
 */
async function loadFeaturesFromDB(): Promise<Record<LineOfBusiness, FeatureMatrix> | null> {
  if (cache.data && Date.now() - cache.loadedAt < CACHE_TTL) {
    return cache.data;
  }

  try {
    // Solo funciona del lado del servidor
    if (typeof window !== "undefined") return null;

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("plan_features")
      .select("line, plan, enabled, feature:feature_definitions(key)")
      .eq("feature.is_active", true);

    if (error || !data) return null;

    const matrices: Record<string, Record<string, Record<string, boolean>>> = {
      healthcare: { free: {}, base: {}, standard: {}, premium: {} },
      business: { free: {}, base: {}, standard: {}, premium: {} },
    };

    for (const row of data) {
      const featureData = row.feature as unknown as { key: string } | null;
      if (!featureData?.key) continue;
      if (matrices[row.line]?.[row.plan]) {
        matrices[row.line][row.plan][featureData.key] = row.enabled;
      }
    }

    const result = matrices as Record<LineOfBusiness, FeatureMatrix>;
    cache = { data: result, loadedAt: Date.now() };
    return result;
  } catch {
    return null;
  }
}

/**
 * Invalida el cache para forzar recarga desde DB.
 */
export function invalidateFeatureCache(): void {
  cache = { data: null, loadedAt: 0 };
}

// ─── API pública ────────────────────────────────────────────

/**
 * Verifica si una feature está habilitada para un plan y línea de negocio.
 * Durante el trial se otorgan features de Standard.
 * Versión sincrónica — usa fallback hardcoded.
 */
export function hasFeature(
  feature: FeatureKey,
  plan: SubscriptionPlan,
  line: LineOfBusiness,
  isTrialing = false
): boolean {
  const effectivePlan = isTrialing ? "standard" : plan;
  return FALLBACK_MATRICES[line]?.[effectivePlan]?.[feature] ?? false;
}

/**
 * Versión asíncrona — intenta leer de DB, fallback a hardcoded.
 */
export async function hasFeatureAsync(
  feature: FeatureKey,
  plan: SubscriptionPlan,
  line: LineOfBusiness,
  isTrialing = false
): Promise<boolean> {
  const effectivePlan = isTrialing ? "standard" : plan;
  const dbMatrix = await loadFeaturesFromDB();
  if (dbMatrix) {
    return dbMatrix[line]?.[effectivePlan]?.[feature] ?? false;
  }
  return FALLBACK_MATRICES[line]?.[effectivePlan]?.[feature] ?? false;
}

/**
 * Devuelve todas las features habilitadas para un plan y línea.
 */
export function getEnabledFeatures(
  plan: SubscriptionPlan,
  line: LineOfBusiness,
  isTrialing = false
): Record<string, boolean> {
  const effectivePlan = isTrialing ? "standard" : plan;
  return { ...FALLBACK_MATRICES[line][effectivePlan] };
}

/**
 * Versión asíncrona — intenta leer de DB.
 */
export async function getEnabledFeaturesAsync(
  plan: SubscriptionPlan,
  line: LineOfBusiness,
  isTrialing = false
): Promise<Record<string, boolean>> {
  const effectivePlan = isTrialing ? "standard" : plan;
  const dbMatrix = await loadFeaturesFromDB();
  if (dbMatrix) {
    return { ...dbMatrix[line][effectivePlan] };
  }
  return { ...FALLBACK_MATRICES[line][effectivePlan] };
}

/**
 * Plan mínimo requerido para acceder a una feature.
 */
export function minimumPlanFor(
  feature: FeatureKey,
  line: LineOfBusiness
): SubscriptionPlan | null {
  const matrix = FALLBACK_MATRICES[line];
  const plans: SubscriptionPlan[] = ["base", "standard", "premium"];
  for (const plan of plans) {
    if (matrix[plan][feature]) return plan;
  }
  return null;
}

export type { FeatureKey };
