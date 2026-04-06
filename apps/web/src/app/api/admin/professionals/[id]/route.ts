import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../../_lib/auth";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types";

// ─── Schemas ─────────────────────────────────────────────────────────────

const updateProfessionalSchema = z.object({
  specialty: z.string().optional(),
  specialty_slug: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  bio: z.string().nullable().optional(),
  is_visible: z.boolean().optional(),
  subscription_plan: z
    .enum(["free", "base", "standard", "premium"] as const)
    .optional(),
  subscription_status: z
    .enum(["trialing", "active", "past_due", "read_only", "cancelled"] as const)
    .optional(),
});

// ─── GET /api/admin/professionals/[id] ────────────────────────────────

/**
 * Obtiene detalles completos de un profesional incluyendo perfil,
 * configuración de agenda y horarios de trabajo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = await params;

    const supabase = await createClient();

    // Obtener profesional con relaciones
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select(
        `
        id,
        clinic_id,
        line,
        specialty,
        specialty_slug,
        bio,
        city,
        province,
        country,
        address,
        latitude,
        longitude,
        public_slug,
        is_visible,
        subscription_plan,
        subscription_status,
        billing_cycle,
        trial_ends_at,
        subscription_expires_at,
        created_at,
        profiles:id (
          full_name,
          phone,
          avatar_url
        )
      `
      )
      .eq("id", id)
      .single();

    if (profError || !professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // Obtener configuración de agenda
    const { data: scheduleConfig } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("professional_id", id)
      .single();

    // Obtener horarios de trabajo
    const { data: workingHours } = await supabase
      .from("working_hours")
      .select("*")
      .eq("professional_id", id)
      .order("day_of_week");

    // Contar turnos del mes
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { data: appointments, error: apptError } = await supabase
      .from("appointments")
      .select("status", { count: "exact" })
      .eq("professional_id", id)
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd);

    const appointmentStats = {
      total: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };

    if (!apptError && appointments) {
      appointmentStats.total = appointments.length;
      appointments.forEach((a: any) => {
        if (a.status === "confirmed") appointmentStats.confirmed++;
        if (a.status === "completed") appointmentStats.completed++;
        if (a.status === "cancelled") appointmentStats.cancelled++;
        if (a.status === "no_show") appointmentStats.no_show++;
      });
    }

    return NextResponse.json({
      professional: {
        ...professional,
        scheduleConfig,
        workingHours,
        appointmentStats,
      },
    });
  } catch (error) {
    console.error("[GET professional/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PATCH /api/admin/professionals/[id] ──────────────────────────────

/**
 * Actualiza campos de un profesional.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = await params;
    const body = (await request.json()) as unknown;
    const parsed = updateProfessionalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Actualizar solo los campos proporcionados
    const updateData: Record<string, any> = {};
    if (parsed.data.specialty) updateData.specialty = parsed.data.specialty;
    if (parsed.data.specialty_slug)
      updateData.specialty_slug = parsed.data.specialty_slug;
    if (parsed.data.city) updateData.city = parsed.data.city;
    if (parsed.data.province) updateData.province = parsed.data.province;
    if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio;
    if (parsed.data.is_visible !== undefined)
      updateData.is_visible = parsed.data.is_visible;
    if (parsed.data.subscription_plan)
      updateData.subscription_plan = parsed.data.subscription_plan;
    if (parsed.data.subscription_status)
      updateData.subscription_status = parsed.data.subscription_status;

    const { data: updated, error } = await admin
      .from("professionals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH professional error]", error);
      return NextResponse.json(
        { error: "Error al actualizar profesional" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Profesional actualizado",
      professional: updated,
    });
  } catch (error) {
    console.error("[PATCH professional/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/professionals/[id] ─────────────────────────────

/**
 * Soft-delete: marca como no visible.
 * Pasá hard_delete=true en el body para eliminar completamente.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = await params;
    const body = (await request.json()) as { hard_delete?: boolean };

    const admin = createAdminClient();

    if (body.hard_delete) {
      // Hard delete: eliminar todas las referencias
      // Primero marcar fecha de retención de datos
      await admin
        .from("professionals")
        .update({
          data_retention_until: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .eq("id", id);

      // Luego eliminar el usuario de auth
      await admin.auth.admin.deleteUser(id);
    } else {
      // Soft delete: solo marcar como no visible
      await admin
        .from("professionals")
        .update({ is_visible: false })
        .eq("id", id);
    }

    return NextResponse.json({
      message: body.hard_delete
        ? "Profesional eliminado"
        : "Profesional marcado como no visible",
    });
  } catch (error) {
    console.error("[DELETE professional/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
