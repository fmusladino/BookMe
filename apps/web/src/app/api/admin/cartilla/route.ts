import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "../_lib/auth";

/**
 * GET /api/admin/cartilla — Lista todos los profesionales con su estado de cartilla
 * Query params:
 *   - status: "all" | "visible" | "hidden" (default: "all")
 *   - search: texto libre para buscar por nombre, especialidad o email
 *   - line: "healthcare" | "business" (opcional)
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search")?.trim() || "";
    const line = searchParams.get("line") || "";

    const admin = createAdminClient();

    // 1. Obtener profesionales
    let proQuery = admin
      .from("professionals")
      .select("id, specialty, specialty_slug, city, province, line, public_slug, is_visible, subscription_plan, subscription_status, created_at")
      .order("created_at", { ascending: false });

    if (status === "visible") {
      proQuery = proQuery.eq("is_visible", true);
    } else if (status === "hidden") {
      proQuery = proQuery.eq("is_visible", false);
    }

    if (line === "healthcare" || line === "business") {
      proQuery = proQuery.eq("line", line);
    }

    const { data: prosData, error: prosError } = await proQuery;

    if (prosError) {
      console.error("[Cartilla] Error fetching professionals:", prosError.message, prosError.code);
      return NextResponse.json({ error: "Error al cargar profesionales", details: prosError.message }, { status: 500 });
    }

    const allPros = prosData || [];

    // 2. Obtener perfiles para enriquecer
    const proIds = allPros.map((p) => p.id);
    let profilesMap: Record<string, { full_name: string; email?: string; avatar_url: string | null; phone: string | null }> = {};

    if (proIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url, phone")
        .in("id", proIds);

      if (profiles) {
        for (const p of profiles) {
          profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url, phone: p.phone };
        }
      }

      // Obtener emails desde auth
      const { data: authUsersResult } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (authUsersResult?.users) {
        for (const u of authUsersResult.users) {
          if (u.email && profilesMap[u.id]) {
            profilesMap[u.id].email = u.email;
          }
        }
      }
    }

    // 3. Enriquecer y filtrar
    let professionals = allPros.map((p) => ({
      ...p,
      profile: profilesMap[p.id] || { full_name: "Sin nombre", email: "—", avatar_url: null, phone: null },
    }));

    if (search) {
      const term = search.toLowerCase();
      professionals = professionals.filter((p) => {
        const name = (p.profile.full_name || "").toLowerCase();
        const email = (p.profile.email || "").toLowerCase();
        const spec = (p.specialty || "").toLowerCase();
        const city = (p.city || "").toLowerCase();
        return name.includes(term) || email.includes(term) || spec.includes(term) || city.includes(term);
      });
    }

    // 4. Conteos (sobre el total sin filtro de búsqueda)
    const counts = {
      total: allPros.length,
      visible: allPros.filter((p) => p.is_visible).length,
      hidden: allPros.filter((p) => !p.is_visible).length,
    };

    return NextResponse.json({ professionals, counts });
  } catch (err) {
    console.error("[Cartilla] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
