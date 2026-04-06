import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";

// ─── Schemas ─────────────────────────────────────────────────────────────

const createClinicSchema = z.object({
  name: z.string().min(1, "Nombre de clínica requerido"),
  owner_id: z.string().uuid("ID de propietario inválido"),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

// ─── GET /api/admin/clinics ───────────────────────────────────────────

/**
 * Lista todas las clínicas con información del propietario
 * y cantidad de profesionales asociados.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();

    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select(
        `
        id,
        name,
        slug,
        owner_id,
        address,
        city,
        province,
        country,
        phone,
        email,
        logo_url,
        created_at,
        owner:owner_id (
          full_name,
          email: id,
          phone
        )
      `,
        { count: "exact" }
      );

    if (clinicsError) {
      console.error("[GET clinics error]", clinicsError);
      return NextResponse.json(
        { error: "Error al obtener clínicas" },
        { status: 500 }
      );
    }

    // Para cada clínica, contar profesionales asociados
    const clinicsWithCounts = await Promise.all(
      (clinics || []).map(async (c: any) => {
        const { count: profCount } = await supabase
          .from("professionals")
          .select("id", { count: "exact" })
          .eq("clinic_id", c.id);

        return {
          ...c,
          professional_count: profCount || 0,
        };
      })
    );

    return NextResponse.json({
      clinics: clinicsWithCounts,
      total: clinics?.length || 0,
    });
  } catch (error) {
    console.error("[GET clinics]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/clinics ──────────────────────────────────────────

/**
 * Crea una nueva clínica.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = (await request.json()) as unknown;
    const parsed = createClinicSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      name,
      owner_id,
      address,
      city,
      province,
      phone,
      email,
    } = parsed.data;

    const admin = createAdminClient();

    // Verificar que el owner existe y es un profesional
    const { data: owner, error: ownerError } = await admin
      .from("professionals")
      .select("id")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: "Propietario (profesional) no encontrado" },
        { status: 404 }
      );
    }

    // Generar slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const { data: clinic, error } = await admin
      .from("clinics")
      .insert({
        name,
        slug,
        owner_id,
        address: address || null,
        city: city || null,
        province: province || null,
        country: "Argentina",
        phone: phone || null,
        email: email || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST clinic error]", error);
      return NextResponse.json(
        { error: "Error al crear clínica" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Clínica creada exitosamente",
        clinic,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST clinics]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
