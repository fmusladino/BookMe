import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/schedule/blocks — listar bloqueos del profesional
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let query = supabase
      .from("schedule_blocks")
      .select("*")
      .eq("professional_id", user.id)
      .order("starts_at", { ascending: true });

    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lte("ends_at", to);

    const { data: blocks, error } = await query;

    if (error) {
      console.error("Error al obtener bloqueos:", error);
      return NextResponse.json({ error: "Error al obtener bloqueos" }, { status: 500 });
    }

    return NextResponse.json({ blocks: blocks ?? [] });
  } catch (error) {
    console.error("Error al obtener bloqueos:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/schedule/blocks — crear un bloqueo
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json() as {
      startsAt: string;
      endsAt: string;
      reason?: string;
    };

    if (new Date(body.startsAt) >= new Date(body.endsAt)) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser anterior a la de fin" },
        { status: 400 }
      );
    }

    const { data: block, error } = await supabase
      .from("schedule_blocks")
      .insert({
        professional_id: user.id,
        starts_at: body.startsAt,
        ends_at: body.endsAt,
        reason: body.reason ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error al crear bloqueo:", error);
      return NextResponse.json({ error: "Error al crear bloqueo" }, { status: 500 });
    }

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    console.error("Error al crear bloqueo:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/schedule/blocks — eliminar un bloqueo por ID (via query param)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const url = new URL(request.url);
    const blockId = url.searchParams.get("id");

    if (!blockId) {
      return NextResponse.json({ error: "ID de bloqueo requerido" }, { status: 400 });
    }

    const { error } = await supabase
      .from("schedule_blocks")
      .delete()
      .eq("id", blockId)
      .eq("professional_id", user.id);

    if (error) {
      console.error("Error al eliminar bloqueo:", error);
      return NextResponse.json({ error: "Error al eliminar bloqueo" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error al eliminar bloqueo:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
