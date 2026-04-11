import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  business_name: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  is_visible: z.boolean().optional(),
});

/**
 * GET /api/court-owners/me — Perfil del dueño de canchas autenticado
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: profile, error } = await supabase
      .from("court_owners")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET /api/court-owners/me:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/court-owners/me — Actualiza perfil del dueño de canchas
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await request.json()) as unknown;
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from("court_owners")
      .update(parsed.data)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("PATCH /api/court-owners/me:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
