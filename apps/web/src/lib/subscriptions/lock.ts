/**
 * Bloqueo de cuenta — modo solo lectura.
 *
 * Una cuenta está "locked" cuando:
 *  - subscription_status === "read_only" (cron de impago lo seteó al día 15)
 *  - subscription_status === "cancelled"
 *  - subscription_status === "trialing" Y el trial ya expiró (trial_ends_at < now)
 *
 * Estado locked = puede LEER todo el dashboard, pero no puede crear, editar
 * ni eliminar recursos. Los endpoints de escritura devuelven 403 y la UI
 * desactiva los botones de acción.
 */
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface LockableSubscription {
  status: string | null | undefined;
  trial_ends_at: string | null | undefined;
}

export function isAccountLocked(sub: LockableSubscription | null | undefined): boolean {
  if (!sub) return false;
  const status = sub.status ?? "trialing";

  if (status === "read_only" || status === "cancelled" || status === "expired") {
    return true;
  }

  if (status === "trialing" && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at).getTime();
    if (!isNaN(trialEnd) && trialEnd < Date.now()) {
      return true;
    }
  }

  return false;
}

export interface LockReason {
  reason: "trial_expired" | "past_due" | "cancelled" | "expired";
  message: string;
}

export function getLockReason(sub: LockableSubscription | null | undefined): LockReason | null {
  if (!sub || !isAccountLocked(sub)) return null;
  const status = sub.status ?? "trialing";

  if (status === "trialing") {
    return {
      reason: "trial_expired",
      message: "Tu período de prueba expiró. Elegí un plan para continuar usando BookMe.",
    };
  }
  if (status === "read_only") {
    return {
      reason: "past_due",
      message: "Tu suscripción tiene pagos pendientes. Regularizá para volver a operar.",
    };
  }
  if (status === "cancelled") {
    return {
      reason: "cancelled",
      message: "Tu suscripción fue cancelada. Reactivá un plan para continuar.",
    };
  }
  return {
    reason: "expired",
    message: "Tu suscripción venció. Elegí un plan para continuar.",
  };
}

/**
 * Guard server-side para endpoints de escritura del profesional.
 * Devuelve null si la cuenta puede escribir, o un NextResponse 403 si está locked.
 *
 * Uso típico al inicio de una ruta POST/PATCH/DELETE:
 *
 *   const lockResp = await assertCanWrite();
 *   if (lockResp) return lockResp;
 */
export async function assertCanWrite(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // No hay sesión — el endpoint que llama ya validará auth, no es nuestra responsabilidad.
    return null;
  }

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("professionals")
    .select("subscription_status, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle();

  // No es profesional → no aplica el lock (puede ser paciente, admin de clínica, etc.)
  if (!prof) return null;

  const sub = prof as { subscription_status: string | null; trial_ends_at: string | null };
  if (!isAccountLocked({ status: sub.subscription_status, trial_ends_at: sub.trial_ends_at })) {
    return null;
  }

  const lockReason = getLockReason({ status: sub.subscription_status, trial_ends_at: sub.trial_ends_at });
  return NextResponse.json(
    {
      error: lockReason?.message ?? "Tu cuenta está en modo solo lectura.",
      reason: lockReason?.reason ?? "expired",
      locked: true,
    },
    { status: 403 }
  );
}
