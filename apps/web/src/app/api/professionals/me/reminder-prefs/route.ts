import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ALLOWED_CHANNELS = ["email", "whatsapp"] as const;
const MAX_OFFSETS = 5;
const MAX_OFFSET_MINUTES = 10080; // 7 días, coherente con el CHECK en DB

/**
 * GET /api/professionals/me/reminder-prefs
 * Devuelve los offsets (minutos antes del turno) y canales configurados.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("professionals")
      .select("reminder_offsets, reminder_channels")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      offsets: data.reminder_offsets ?? [],
      channels: data.reminder_channels ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT /api/professionals/me/reminder-prefs
 * Body: { offsets: number[], channels: string[] }
 *   offsets: minutos antes del turno (ej: [2880, 1440, 120])
 *   channels: subset de ["email", "whatsapp"]
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json() as { offsets?: unknown; channels?: unknown };

    if (!Array.isArray(body.offsets) || !Array.isArray(body.channels)) {
      return NextResponse.json(
        { error: "offsets y channels deben ser arrays" },
        { status: 400 }
      );
    }

    // Validar offsets
    if (body.offsets.length > MAX_OFFSETS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_OFFSETS} recordatorios por turno` },
        { status: 400 }
      );
    }

    const offsets: number[] = [];
    for (const o of body.offsets) {
      if (typeof o !== "number" || !Number.isFinite(o) || !Number.isInteger(o)) {
        return NextResponse.json({ error: "offsets debe contener enteros" }, { status: 400 });
      }
      if (o <= 0 || o > MAX_OFFSET_MINUTES) {
        return NextResponse.json(
          { error: `cada offset debe ser entre 1 y ${MAX_OFFSET_MINUTES} minutos` },
          { status: 400 }
        );
      }
      if (!offsets.includes(o)) offsets.push(o);
    }
    offsets.sort((a, b) => b - a); // orden descendente para consistencia

    // Validar canales
    const channels: string[] = [];
    for (const c of body.channels) {
      if (typeof c !== "string" || !ALLOWED_CHANNELS.includes(c as typeof ALLOWED_CHANNELS[number])) {
        return NextResponse.json(
          { error: `canales válidos: ${ALLOWED_CHANNELS.join(", ")}` },
          { status: 400 }
        );
      }
      if (!channels.includes(c)) channels.push(c);
    }

    const admin = createAdminClient();
    const { error: updateErr } = await admin
      .from("professionals")
      .update({
        reminder_offsets: offsets,
        reminder_channels: channels,
      })
      .eq("id", user.id);

    if (updateErr) {
      console.error("Error al actualizar reminder prefs:", updateErr);
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    return NextResponse.json({ success: true, offsets, channels });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
