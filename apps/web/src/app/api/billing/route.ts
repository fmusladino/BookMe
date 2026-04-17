export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createBillingItemSchema = z.object({
  appointment_id: z.string().uuid("ID de cita inválido"),
  insurance_id: z.string().uuid("ID de seguro inválido"),
  practice_code: z.string().min(1, "Código de práctica requerido"),
  practice_name: z.string().min(1, "Nombre de práctica requerido"),
  amount: z.number().min(0, "Monto debe ser positivo"),
  period_month: z.number().int().min(1).max(12),
  period_year: z.number().int().min(2000),
});

type BillingItem = {
  id: string;
  professional_id: string;
  patient_id: string;
  appointment_id: string;
  insurance_id: string;
  practice_code: string;
  practice_name: string;
  amount: number;
  status: string;
  period_month: number;
  period_year: number;
  facturante_ref: string | null;
  created_at: string;
  patient?: { full_name: string; dni?: string; insurance_number?: string };
  insurance?: { name: string };
  appointment?: { starts_at: string };
};

/**
 * GET /api/billing — Listar items de facturación del profesional autenticado
 * Query params:
 *   - period=YYYY-MM (ej: 2026-04) — filtro legacy por mes
 *   - from=YYYY-MM-DD — inicio del rango de fechas
 *   - to=YYYY-MM-DD — fin del rango de fechas
 *   - status=pending|submitted|paid
 *   - insurance_id=uuid — filtrar por prepaga específica
 * Retorna resumen + items con joins extendidos (datos del paciente con prepaga y plan)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar que sea un profesional healthcare
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "professional") {
      return NextResponse.json(
        { error: "Solo profesionales pueden acceder a facturación" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const insurance_id = searchParams.get("insurance_id");

    let query = supabase
      .from("billing_items")
      .select(
        `id, professional_id, patient_id, appointment_id, insurance_id, practice_code, practice_name, amount, status, period_month, period_year, facturante_ref, created_at,
        patient:patients(full_name, dni, insurance_number),
        insurance:insurances(name),
        appointment:appointments(starts_at)`
      )
      .eq("professional_id", user.id)
      .order("created_at", { ascending: false });

    // Filtro por rango de fechas (prioridad sobre period)
    if (from && to) {
      query = query
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`);
    } else if (from) {
      query = query.gte("created_at", `${from}T00:00:00`);
    } else if (to) {
      query = query.lte("created_at", `${to}T23:59:59`);
    } else if (period) {
      const [year, month] = period.split("-");
      if (year && month) {
        query = query
          .eq("period_year", parseInt(year, 10))
          .eq("period_month", parseInt(month, 10));
      }
    }

    if (status && ["pending", "submitted", "paid"].includes(status)) {
      query = query.eq("status", status);
    }

    if (insurance_id) {
      query = query.eq("insurance_id", insurance_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error billing items:", error.message);
      return NextResponse.json(
        { error: "Error al obtener items de facturación" },
        { status: 500 }
      );
    }

    // Calcular resumen
    const items = (data || []) as BillingItem[];
    const summary = {
      total_amount: items.reduce((sum, item) => sum + Number(item.amount), 0),
      count_pending: items.filter((i) => i.status === "pending").length,
      count_submitted: items.filter((i) => i.status === "submitted").length,
      count_paid: items.filter((i) => i.status === "paid").length,
      items_by_insurance: {} as Record<string, { insurance_id: string; count: number; total: number }>,
    };

    // Agrupar por prepaga
    items.forEach((item) => {
      const insuranceName = item.insurance?.name || "Sin prepaga";
      if (!summary.items_by_insurance[insuranceName]) {
        summary.items_by_insurance[insuranceName] = { insurance_id: item.insurance_id, count: 0, total: 0 };
      }
      summary.items_by_insurance[insuranceName].count += 1;
      summary.items_by_insurance[insuranceName].total += Number(item.amount);
    });

    return NextResponse.json({
      items: (data || []) as BillingResponse[],
      summary,
    });
  } catch (error) {
    console.error("Error GET /api/billing:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/billing — Crear nuevo item de facturación
 * Body: { appointment_id, insurance_id, practice_code, practice_name, amount, period_month, period_year }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar que sea profesional
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "professional") {
      return NextResponse.json(
        { error: "Solo profesionales pueden crear items de facturación" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = createBillingItemSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0];
      return NextResponse.json(
        {
          error: firstError || "Datos inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { appointment_id, insurance_id } = parsed.data;

    // Validar que la cita pertenezca al profesional y tenga un paciente
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, professional_id, patient_id")
      .eq("id", appointment_id)
      .eq("professional_id", user.id)
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: "Cita no encontrada o no pertenece a este profesional" },
        { status: 404 }
      );
    }

    // Validar que el paciente tenga un seguro asignado
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, insurance_id")
      .eq("id", appointment.patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Paciente no encontrado" },
        { status: 404 }
      );
    }

    // Prevenir duplicados: verificar que no exista ya un item de facturación para esta cita
    const { data: existing, error: existingError } = await supabase
      .from("billing_items")
      .select("id")
      .eq("appointment_id", appointment_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: "Ya existe un item de facturación para esta cita",
        },
        { status: 409 }
      );
    }

    // Crear item de facturación
    const { data, error } = await supabase
      .from("billing_items")
      .insert({
        professional_id: user.id,
        patient_id: appointment.patient_id,
        appointment_id,
        insurance_id,
        ...parsed.data,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating billing item:", error.message);
      return NextResponse.json(
        { error: "Error al crear item de facturación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ billing_item: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/billing:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
