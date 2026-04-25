import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "../../_lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/billing/overdue
 *
 * Lista de profesionales con pagos atrasados — alimenta /admin/cobros.
 * Combina la vista `v_overdue_professionals` (que ya une professionals +
 * último payment failed + último reminder) con el email de auth.users.
 *
 * Solo accesible por superadmin.
 */
export async function GET(_request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  const supabase = createAdminClient();

  try {
    const { data: rows, error } = await supabase
      .from("v_overdue_professionals")
      .select("*")
      .order("days_overdue", { ascending: false });

    if (error) {
      console.error("[admin/billing/overdue] Error vista:", error);
      return NextResponse.json({ error: "Error consultando datos" }, { status: 500 });
    }

    // Enriquecer con email — viene de auth.users, no de profiles
    const userIds = (rows ?? []).map((r) => r.professional_id as string);
    const emailById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      for (const u of users?.users ?? []) {
        if (u.email && userIds.includes(u.id)) emailById.set(u.id, u.email);
      }
    }

    const overdue = (rows ?? []).map((r) => ({
      professional_id: r.professional_id,
      full_name: r.full_name,
      email: emailById.get(r.professional_id as string) ?? null,
      subscription_plan: r.subscription_plan,
      subscription_status: r.subscription_status,
      past_due_since: r.past_due_since,
      days_overdue: r.days_overdue,
      last_payment_id: r.last_payment_id,
      last_payment_amount: r.last_payment_amount ? Number(r.last_payment_amount) : null,
      last_failure_reason: r.last_failure_reason,
      last_attempt_at: r.last_attempt_at,
      last_reminder_kind: r.last_reminder_kind,
      last_reminder_at: r.last_reminder_at,
    }));

    // Conteos por bucket — útil para los KPIs arriba de la tabla
    const buckets = {
      total: overdue.length,
      day_0_6: 0,
      day_7_9: 0,
      day_10_13: 0,
      day_14_plus: 0,
      read_only: 0,
    };
    for (const o of overdue) {
      if (o.subscription_status === "read_only") buckets.read_only++;
      const d = o.days_overdue ?? 0;
      if (d < 7) buckets.day_0_6++;
      else if (d < 10) buckets.day_7_9++;
      else if (d < 14) buckets.day_10_13++;
      else buckets.day_14_plus++;
    }

    return NextResponse.json({ overdue, buckets, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error("[admin/billing/overdue]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
