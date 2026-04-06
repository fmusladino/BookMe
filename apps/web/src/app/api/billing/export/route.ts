export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ExportedBillingItem = {
  id: string;
  professional_id: string;
  professional_name: string;
  patient_id: string;
  patient_name: string;
  patient_dni: string;
  appointment_date: string;
  insurance_name: string;
  insurance_code: string | null;
  practice_code: string;
  practice_name: string;
  amount: number;
  status: string;
  period_month: number;
  period_year: number;
  facturante_ref: string | null;
  created_at: string;
};

/**
 * GET /api/billing/export — Exportar items de facturación en formato JSON
 * Listo para integración con Facturante/Factura.ai
 *
 * Query params:
 *   - period=YYYY-MM (ej: 2026-04)
 *
 * Retorna items con información completa del profesional, paciente e insurance
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

    // Verificar que sea profesional
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "professional") {
      return NextResponse.json(
        { error: "Solo profesionales pueden exportar facturación" },
        { status: 403 }
      );
    }

    // Obtener período
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    let query = supabase
      .from("billing_items")
      .select(
        `id, professional_id, patient_id, appointment_id, insurance_id, practice_code, practice_name, amount, status, period_month, period_year, facturante_ref, created_at,
        patient:patients(full_name, dni),
        insurance:insurances(name, code),
        appointment:appointments(starts_at)`
      )
      .eq("professional_id", user.id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("created_at", { ascending: false });

    if (period) {
      const [year, month] = period.split("-");
      if (year && month) {
        query = query
          .eq("period_year", parseInt(year, 10))
          .eq("period_month", parseInt(month, 10));
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json(
        { error: "Error al exportar items de facturación" },
        { status: 500 }
      );
    }

    // Transformar datos para export
    const exportedItems: ExportedBillingItem[] = (data || []).map(
      (item: unknown) => {
        const typedItem = item as {
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
          patient?: { full_name: string; dni: string };
          insurance?: { name: string; code: string | null };
          appointment?: { starts_at: string };
        };

        return {
          id: typedItem.id,
          professional_id: typedItem.professional_id,
          professional_name: profile.full_name,
          patient_id: typedItem.patient_id,
          patient_name: typedItem.patient?.full_name || "",
          patient_dni: typedItem.patient?.dni || "",
          appointment_date: typedItem.appointment?.starts_at || "",
          insurance_name: typedItem.insurance?.name || "",
          insurance_code: typedItem.insurance?.code || null,
          practice_code: typedItem.practice_code,
          practice_name: typedItem.practice_name,
          amount: typedItem.amount,
          status: typedItem.status,
          period_month: typedItem.period_month,
          period_year: typedItem.period_year,
          facturante_ref: typedItem.facturante_ref,
          created_at: typedItem.created_at,
        };
      }
    );

    // Retornar como JSON descargable
    const filename = period
      ? `facturación-${period}.json`
      : "facturación.json";

    return NextResponse.json(
      {
        exported_at: new Date().toISOString(),
        professional: {
          id: profile.id,
          name: profile.full_name,
        },
        period: period || "all",
        count: exportedItems.length,
        items: exportedItems,
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error GET /api/billing/export:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
