export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * GET /api/professionals/me/insurances
 * Devuelve las obras sociales/prepagas que el profesional tiene habilitadas,
 * con los datos de la tabla insurances (join).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("professional_insurances")
      .select(
        `
        id,
        insurance_id,
        is_active,
        created_at,
        insurances:insurance_id (
          id,
          name,
          code,
          logo_url,
          is_active
        )
      `
      )
      .eq("professional_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching professional insurances:", error.message);
      return NextResponse.json(
        { error: "Error al obtener obras sociales" },
        { status: 500 }
      );
    }

    // Aplanar la respuesta para que sea fácil de usar en el frontend
    const insurances = (data ?? []).map((row: Record<string, unknown>) => {
      const ins = row.insurances as Record<string, unknown> | null;
      return {
        id: ins?.id ?? row.insurance_id,
        name: ins?.name ?? "",
        code: ins?.code ?? null,
        logo_url: ins?.logo_url ?? null,
        professional_insurance_id: row.id,
      };
    });

    return NextResponse.json({ insurances });
  } catch (err) {
    console.error("Error GET /api/professionals/me/insurances:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const addInsuranceSchema = z.object({
  // Puede enviar insurance_id existente o name para crear una nueva
  insurance_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().optional(),
});

/**
 * POST /api/professionals/me/insurances
 * Agrega una obra social al profesional. Si no existe en el catálogo global,
 * la crea automáticamente.
 * Body: { insurance_id?: string } | { name: string, code?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parsed = addInsuranceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { insurance_id, name, code } = parsed.data;

    if (!insurance_id && !name) {
      return NextResponse.json(
        { error: "Debe enviar insurance_id o name" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    let finalInsuranceId = insurance_id;

    // Si no se envió insurance_id, buscar o crear en el catálogo global
    if (!finalInsuranceId && name) {
      // Buscar si ya existe por nombre (case-insensitive)
      const { data: existing } = await admin
        .from("insurances")
        .select("id")
        .ilike("name", name)
        .limit(1)
        .single();

      if (existing) {
        finalInsuranceId = existing.id;
      } else {
        // Crear nueva en el catálogo global
        const { data: created, error: createErr } = await admin
          .from("insurances")
          .insert({ name, code: code || null, is_active: true })
          .select("id")
          .single();

        if (createErr || !created) {
          console.error("Error creating insurance:", createErr?.message);
          return NextResponse.json(
            { error: "Error al crear obra social" },
            { status: 500 }
          );
        }
        finalInsuranceId = created.id;
      }
    }

    // Verificar si ya está vinculada
    const { data: existingLink } = await admin
      .from("professional_insurances")
      .select("id, is_active")
      .eq("professional_id", user.id)
      .eq("insurance_id", finalInsuranceId!)
      .single();

    if (existingLink) {
      if (!existingLink.is_active) {
        // Reactivar
        await admin
          .from("professional_insurances")
          .update({ is_active: true })
          .eq("id", existingLink.id);

        return NextResponse.json(
          { success: true, message: "Obra social reactivada" },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: "Ya tenés esta obra social agregada" },
        { status: 409 }
      );
    }

    // Crear vínculo
    const { error: linkErr } = await admin
      .from("professional_insurances")
      .insert({
        professional_id: user.id,
        insurance_id: finalInsuranceId,
        is_active: true,
      });

    if (linkErr) {
      console.error("Error linking insurance:", linkErr.message);
      return NextResponse.json(
        { error: "Error al vincular obra social" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Error POST /api/professionals/me/insurances:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/professionals/me/insurances
 * Desactiva una obra social del profesional (soft-delete).
 * Body: { insurance_id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as { insurance_id?: string };
    if (!body.insurance_id) {
      return NextResponse.json(
        { error: "insurance_id requerido" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("professional_insurances")
      .update({ is_active: false })
      .eq("professional_id", user.id)
      .eq("insurance_id", body.insurance_id);

    if (error) {
      console.error("Error removing insurance:", error.message);
      return NextResponse.json(
        { error: "Error al eliminar obra social" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error DELETE /api/professionals/me/insurances:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
