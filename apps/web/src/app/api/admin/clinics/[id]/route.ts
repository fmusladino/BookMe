import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../../_lib/auth";

// ─── Schemas ─────────────────────────────────────────────────────────────

const updateClinicSchema = z.object({
  name: z.string().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

// ─── GET /api/admin/clinics/[id] ──────────────────────────────────────

/**
 * Obtiene detalles completos de una clínica incluyendo
 * profesionales y admins asociados.
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

    // Obtener clínica
    const { data: clinic, error: clinicError } = await supabase
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
          phone
        )
      `
      )
      .eq("id", id)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: "Clínica no encontrada" },
        { status: 404 }
      );
    }

    // Obtener profesionales asociados
    const { data: professionals } = await supabase
      .from("professionals")
      .select(
        `
        id,
        specialty,
        city,
        is_visible,
        subscription_plan,
        subscription_status,
        profiles:id (
          full_name,
          phone
        )
      `
      )
      .eq("clinic_id", id);

    // Obtener admins de la clínica
    const { data: adminLinks } = await supabase
      .from("clinic_admins")
      .select(
        `
        profile_id,
        profile:profile_id (
          full_name,
          phone,
          email: id
        )
      `
      )
      .eq("clinic_id", id);

    return NextResponse.json({
      clinic: {
        ...clinic,
        professionals: professionals || [],
        admins: (adminLinks || []).map((a: any) => a.profile),
      },
    });
  } catch (error) {
    console.error("[GET clinic/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PATCH /api/admin/clinics/[id] ────────────────────────────────────

/**
 * Actualiza campos de una clínica.
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
    const parsed = updateClinicSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const updateData: Record<string, any> = {};
    if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
    if (parsed.data.city !== undefined) updateData.city = parsed.data.city;
    if (parsed.data.province !== undefined)
      updateData.province = parsed.data.province;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;

    const { data: updated, error } = await admin
      .from("clinics")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH clinic error]", error);
      return NextResponse.json(
        { error: "Error al actualizar clínica" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Clínica actualizada",
      clinic: updated,
    });
  } catch (error) {
    console.error("[PATCH clinic/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/clinics/[id] ───────────────────────────────────

/**
 * Elimina una clínica.
 * No permite eliminar si tiene profesionales activos asociados.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = await params;

    const supabase = await createClient();

    // Verificar si tiene profesionales activos
    const { data: professionals, error: profError } = await supabase
      .from("professionals")
      .select("id", { count: "exact" })
      .eq("clinic_id", id)
      .eq("is_visible", true);

    if (!profError && professionals && professionals.length > 0) {
      return NextResponse.json(
        {
          error: "No se puede eliminar una clínica con profesionales activos",
        },
        { status: 409 }
      );
    }

    const admin = createAdminClient();

    // Eliminar la clínica
    const { error } = await admin.from("clinics").delete().eq("id", id);

    if (error) {
      console.error("[DELETE clinic error]", error);
      return NextResponse.json(
        { error: "Error al eliminar clínica" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Clínica eliminada",
    });
  } catch (error) {
    console.error("[DELETE clinic/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
