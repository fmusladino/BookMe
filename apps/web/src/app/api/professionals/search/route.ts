import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/professionals/search — Búsqueda de profesionales en directorio público
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || searchParams.get("search")?.trim() || "";
    const city = searchParams.get("city")?.trim() || "";
    const specialty = searchParams.get("specialty")?.trim() || "";
    const line = searchParams.get("line") as "healthcare" | "business" | null;
    const pageStr = searchParams.get("page") || "1";
    const limitStr = searchParams.get("limit") || "12";

    const page = Math.max(1, parseInt(pageStr, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr, 10)));
    const offset = (page - 1) * limit;

    const admin = createAdminClient();

    // Query base — solo profesionales visibles con suscripción activa o trial
    let query = admin
      .from("professionals")
      .select(
        `id,
         public_slug,
         specialty,
         specialty_slug,
         bio,
         city,
         province,
         line,
         subscription_status`,
        { count: "exact" }
      )
      .eq("is_visible", true)
      .not("subscription_status", "eq", "cancelled");

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    if (specialty) {
      query = query.eq("specialty_slug", specialty);
    }

    if (line) {
      query = query.eq("line", line);
    }

    if (q) {
      const searchTerm = `%${q}%`;
      query = query.or(
        `specialty.ilike.${searchTerm},bio.ilike.${searchTerm},city.ilike.${searchTerm}`
      );
    }

    query = query.order("created_at", { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: prosData, error: prosError, count } = await query;

    if (prosError) {
      console.error("[Search] Supabase error:", prosError.message, prosError.code);
      return NextResponse.json(
        { error: "Error al buscar profesionales", details: prosError.message },
        { status: 500 }
      );
    }

    const allPros = prosData || [];

    // Obtener perfiles para enriquecer (query separada para evitar problemas de join)
    let profilesMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {};
    let servicesCountMap: Record<string, number> = {};

    if (allPros.length > 0) {
      const proIds = allPros.map((p) => p.id);

      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", proIds);

      if (profiles) {
        for (const p of profiles) {
          profilesMap[p.id] = p;
        }
      }

      // Contar servicios
      const { data: services } = await admin
        .from("services")
        .select("id, professional_id")
        .in("professional_id", proIds)
        .eq("is_active", true);

      if (services) {
        for (const s of services) {
          servicesCountMap[s.professional_id] = (servicesCountMap[s.professional_id] || 0) + 1;
        }
      }
    }

    const professionals = allPros.map((pro) => ({
      id: pro.id,
      public_slug: pro.public_slug,
      specialty: pro.specialty,
      specialty_slug: pro.specialty_slug,
      bio: pro.bio,
      city: pro.city,
      province: pro.province,
      line: pro.line,
      profile: profilesMap[pro.id] || { id: pro.id, full_name: "Profesional", avatar_url: null },
      services_count: servicesCountMap[pro.id] || 0,
    }));

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      professionals,
      total: count || 0,
      page,
      totalPages,
      pages: totalPages, // alias para compatibilidad con la página
    });
  } catch (error) {
    console.error("[Search] Unexpected error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
