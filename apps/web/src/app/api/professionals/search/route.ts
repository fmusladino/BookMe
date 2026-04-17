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
    const province = searchParams.get("province")?.trim() || "";
    const insuranceId = searchParams.get("insurance")?.trim() || "";
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
         country,
         address,
         postal_code,
         line,
         subscription_status`,
        { count: "exact" }
      )
      .eq("is_visible", true)
      .not("subscription_status", "eq", "cancelled");

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    if (province) {
      query = query.ilike("province", `%${province}%`);
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

    // Si se filtra por obra social, primero obtener los IDs de profesionales que la aceptan
    let insuranceFilterIds: string[] | null = null;
    if (insuranceId) {
      const proIdsFromInsurance = new Set<string>();

      // Buscar en professional_insurances
      try {
        const { data: piData } = await admin
          .from("professional_insurances")
          .select("professional_id")
          .eq("insurance_id", insuranceId)
          .eq("is_active", true);
        if (piData) {
          for (const row of piData) proIdsFromInsurance.add(row.professional_id);
        }
      } catch { /* tabla puede no existir */ }

      // Buscar en prestaciones
      try {
        const { data: prestData } = await admin
          .from("prestaciones")
          .select("professional_id")
          .eq("insurance_id", insuranceId)
          .eq("is_active", true);
        if (prestData) {
          for (const row of prestData) proIdsFromInsurance.add(row.professional_id);
        }
      } catch { /* tabla puede no existir */ }

      // Buscar en service_insurances → services → professional_id
      try {
        const { data: siData } = await admin
          .from("service_insurances")
          .select("service_id, service:services(professional_id)")
          .eq("insurance_id", insuranceId);
        if (siData) {
          for (const row of siData) {
            const svc = row.service as unknown as { professional_id: string } | null;
            if (svc) proIdsFromInsurance.add(svc.professional_id);
          }
        }
      } catch { /* tabla puede no existir */ }

      insuranceFilterIds = Array.from(proIdsFromInsurance);

      // Si no hay ningún profesional con esa OS, devolver vacío directamente
      if (insuranceFilterIds.length === 0) {
        return NextResponse.json({
          professionals: [],
          total: 0,
          page,
          totalPages: 0,
          pages: 0,
        });
      }

      query = query.in("id", insuranceFilterIds);
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
    let insurancesMap: Record<string, { id: string; name: string }[]> = {};

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

      // Obtener obras sociales / prepagas por profesional
      // Fuente 1: prestaciones (cada prestación tiene insurance_id)
      try {
        const { data: prestaciones } = await admin
          .from("prestaciones")
          .select("professional_id, insurance:insurances(id, name)")
          .in("professional_id", proIds)
          .eq("is_active", true);

        if (prestaciones) {
          for (const p of prestaciones) {
            if (p.insurance) {
              if (!insurancesMap[p.professional_id]) {
                insurancesMap[p.professional_id] = [];
              }
              const ins = p.insurance as unknown as { id: string; name: string };
              if (!insurancesMap[p.professional_id].find((i) => i.id === ins.id)) {
                insurancesMap[p.professional_id].push(ins);
              }
            }
          }
        }
      } catch {
        // prestaciones table might not exist — skip
      }

      // Fuente 2: service_insurances (servicios vinculados a OS)
      try {
        const serviceIds = (services || []).map((s) => s.id);
        if (serviceIds.length > 0) {
          const { data: serviceInsurances } = await admin
            .from("service_insurances")
            .select("service_id, insurance:insurances(id, name)")
            .in("service_id", serviceIds);

          if (serviceInsurances) {
            const serviceToProMap: Record<string, string> = {};
            for (const s of services || []) {
              serviceToProMap[s.id] = s.professional_id;
            }

            for (const si of serviceInsurances) {
              const proId = serviceToProMap[si.service_id];
              if (proId && si.insurance) {
                if (!insurancesMap[proId]) {
                  insurancesMap[proId] = [];
                }
                const ins = si.insurance as unknown as { id: string; name: string };
                if (!insurancesMap[proId].find((i) => i.id === ins.id)) {
                  insurancesMap[proId].push(ins);
                }
              }
            }
          }
        }
      } catch {
        // service_insurances table might not exist — skip
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
      country: pro.country,
      address: pro.address,
      postal_code: pro.postal_code,
      line: pro.line,
      profile: profilesMap[pro.id] || { id: pro.id, full_name: "Profesional", avatar_url: null },
      services_count: servicesCountMap[pro.id] || 0,
      insurances: insurancesMap[pro.id] || [],
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
