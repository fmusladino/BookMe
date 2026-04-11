import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/court-owners/[slug] — Datos públicos del complejo por slug (sin auth)
 * Incluye las canchas activas con sus horarios.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const admin = createAdminClient();

    const { data: owner, error: ownerError } = await admin
      .from("court_owners")
      .select(`
        id,
        business_name,
        slug,
        description,
        address,
        city,
        province,
        country,
        phone,
        whatsapp,
        is_visible
      `)
      .eq("slug", slug)
      .eq("is_visible", true)
      .single();

    if (ownerError || !owner) {
      return NextResponse.json({ error: "Complejo no encontrado" }, { status: 404 });
    }

    // Obtener canchas activas con sus horarios
    const { data: courts, error: courtsError } = await admin
      .from("courts")
      .select(`
        id,
        name,
        description,
        sport,
        surface,
        players,
        price_per_hour,
        slot_duration,
        seña_required,
        seña_amount,
        seña_alias,
        is_active,
        court_schedules (
          id,
          day_of_week,
          start_time,
          end_time
        )
      `)
      .eq("owner_id", owner.id)
      .eq("is_active", true)
      .order("name");

    if (courtsError) throw courtsError;

    return NextResponse.json({
      owner,
      courts: courts ?? [],
    });
  } catch (error) {
    console.error("GET /api/court-owners/[slug]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
