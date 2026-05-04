"use client";

import { useSession } from "@/hooks/use-session";

/**
 * Hook UI para saber si la cuenta del profesional está en modo solo lectura.
 *
 * Una cuenta locked puede leer todo el dashboard pero no puede crear, editar
 * ni eliminar recursos. Los botones de acción deben quedar desactivados.
 *
 * El bloqueo real se aplica server-side (assertCanWrite en cada endpoint POST/
 * PATCH/DELETE) — este hook solo es para UX, evitar que el usuario clickee y
 * reciba un error 403 confuso.
 */
export interface AccountLockState {
  /** True si la cuenta está locked (trial expirado, impago o cancelada). */
  isLocked: boolean;
  /** Razón del bloqueo, útil para tooltips. */
  reason: "trial_expired" | "past_due" | "cancelled" | "expired" | null;
  /** Mensaje listo para mostrar al usuario. */
  message: string | null;
  /** True mientras se está cargando la sesión (evita parpadeos). */
  loading: boolean;
}

export function useAccountLocked(): AccountLockState {
  const { user, loading } = useSession();
  const sub = user?.subscription;

  return {
    isLocked: !!sub?.isLocked,
    reason: sub?.lockReason ?? null,
    message: sub?.lockMessage ?? null,
    loading,
  };
}
