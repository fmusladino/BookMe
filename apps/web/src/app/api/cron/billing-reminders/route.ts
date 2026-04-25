import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/security";
import {
  sendPaymentReminderEmail,
  sendPaymentReminderWhatsApp,
  type PaymentReminderKind,
} from "@bookme/notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/billing-reminders
 *
 * Vercel Cron diario (vercel.json: "0 11 * * *" → 11 UTC = 8 AM ARG).
 *
 * Funcionalidad #27 del MVP — gestión de impago de abonos:
 *   • Día  7 → recordatorio "soft"     (email + WhatsApp, tono amable)
 *   • Día 10 → recordatorio "firm"     (tono firme)
 *   • Día 14 → recordatorio "final"    (aviso de suspensión inminente)
 *   • Día 15 → "read_only"             (cambia subscription_status a read_only)
 *
 * Idempotente: usa la tabla `payment_reminders` (UNIQUE payment_id+kind) para
 * no reenviar si el cron corre dos veces el mismo día.
 *
 * Requiere `professionals.past_due_since` (lo setea el webhook MP cuando un
 * cobro pasa a estado paused/failed). Si está NULL, el profesional no está
 * en mora y se ignora.
 */

interface OverdueProfessional {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  past_due_since: string;
  payment: { id: string; amount: number; currency: string } | null;
  already_sent: Set<PaymentReminderKind>;
}

/** Mapeo de días en mora → kind de recordatorio. Null = no corresponde nada. */
function reminderKindForDay(daysOverdue: number): PaymentReminderKind | null {
  if (daysOverdue >= 15) return "read_only";
  if (daysOverdue >= 14) return "final";
  if (daysOverdue >= 10) return "firm";
  if (daysOverdue >= 7) return "soft";
  return null;
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const now = new Date();

  try {
    // 1. Cargar profesionales con past_due_since seteado.
    const { data: pros, error } = await supabase
      .from("professionals")
      .select(
        `id, past_due_since, subscription_status,
         profile:profiles!id(full_name, phone)`
      )
      .in("subscription_status", ["past_due", "read_only"])
      .not("past_due_since", "is", null);

    if (error) {
      console.error("[billing-reminders] Error al cargar profesionales:", error);
      return NextResponse.json({ error: "Error consultando datos" }, { status: 500 });
    }

    if (!pros || pros.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        evaluated: 0,
        sent: 0,
        message: "No hay profesionales en mora",
      });
    }

    // 2. Cargar emails desde auth.users (no están en profiles).
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailByUserId = new Map<string, string>();
    for (const u of authUsers?.users ?? []) {
      if (u.email) emailByUserId.set(u.id, u.email);
    }

    // 3. Por cada profesional: último payment failed + reminders ya enviados.
    const overdueList: OverdueProfessional[] = [];
    for (const p of pros) {
      const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
      if (!profile) continue;

      const { data: lastPayment } = await supabase
        .from("payments")
        .select("id, amount, currency")
        .eq("professional_id", p.id)
        .eq("status", "failed")
        .order("attempted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: priorReminders } = await supabase
        .from("payment_reminders")
        .select("kind")
        .eq("professional_id", p.id);

      const sentKinds = new Set<PaymentReminderKind>();
      for (const r of priorReminders ?? []) {
        sentKinds.add(r.kind as PaymentReminderKind);
      }

      overdueList.push({
        id: p.id,
        full_name: profile.full_name,
        email: emailByUserId.get(p.id) ?? null,
        phone: profile.phone ?? null,
        past_due_since: p.past_due_since as string,
        payment: lastPayment
          ? {
              id: lastPayment.id,
              amount: Number(lastPayment.amount),
              currency: lastPayment.currency,
            }
          : null,
        already_sent: sentKinds,
      });
    }

    // 4. Procesar cada profesional según su día de mora.
    const counts: Record<PaymentReminderKind, number> = { soft: 0, firm: 0, final: 0, read_only: 0 };
    let skipped = 0;
    const errors: string[] = [];

    for (const pro of overdueList) {
      const days = Math.floor(
        (now.getTime() - new Date(pro.past_due_since).getTime()) / (1000 * 60 * 60 * 24)
      );
      const kind = reminderKindForDay(days);

      if (!kind) { skipped++; continue; }
      if (pro.already_sent.has(kind)) { skipped++; continue; }
      if (!pro.payment) {
        console.warn(`[billing-reminders] ${pro.id} sin payment failed — skip`);
        skipped++;
        continue;
      }

      // 4.a. Si llegamos al día 15: cambiar el status a read_only ANTES de notificar.
      if (kind === "read_only") {
        await supabase
          .from("professionals")
          .update({ subscription_status: "read_only" })
          .eq("id", pro.id);
      }

      // 4.b. Mandar email + WhatsApp (cada canal en try/catch independiente).
      const channels: string[] = [];
      const reminderData = {
        professionalName: pro.full_name,
        amount: pro.payment.amount,
        currency: pro.payment.currency,
        daysOverdue: days,
      };

      if (pro.email && isEmailConfigured()) {
        try {
          await sendPaymentReminderEmail(kind, { ...reminderData, to: pro.email });
          channels.push("email");
        } catch (err) {
          errors.push(`${pro.id} email ${kind}: ${String(err)}`);
        }
      }

      if (pro.phone && isWhatsAppConfigured()) {
        try {
          await sendPaymentReminderWhatsApp(kind, { ...reminderData, to: pro.phone });
          channels.push("whatsapp");
        } catch (err) {
          errors.push(`${pro.id} whatsapp ${kind}: ${String(err)}`);
        }
      }

      // 4.c. Registrar el reminder (incluso si no había canales — sirve de log).
      const { error: insertErr } = await supabase
        .from("payment_reminders")
        .insert({
          payment_id: pro.payment.id,
          professional_id: pro.id,
          kind,
          channels: channels.join(","),
          days_overdue: days,
        });

      if (insertErr && !insertErr.message?.includes("duplicate")) {
        errors.push(`${pro.id} insert reminder ${kind}: ${insertErr.message}`);
        continue;
      }

      counts[kind]++;
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      evaluated: overdueList.length,
      sent: counts.soft + counts.firm + counts.final + counts.read_only,
      summary: { ...counts, skipped, errors },
    });
  } catch (err) {
    console.error("[billing-reminders] Error inesperado:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── Helpers de configuración ──────────────────────────────────────────────
function isEmailConfigured(): boolean {
  const k = process.env["RESEND_API_KEY"];
  return !!k && k !== "placeholder";
}

const TWILIO_PREFIX_REGEX = /^[A-Z]{2}/;
function isWhatsAppConfigured(): boolean {
  const sid = process.env["TWILIO_ACCOUNT_SID"] ?? "";
  return !!sid && sid !== "placeholder" && TWILIO_PREFIX_REGEX.test(sid);
}
