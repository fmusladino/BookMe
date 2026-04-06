import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema para validar la suscripción Push
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Endpoint inválido"),
  keys: z.object({
    p256dh: z.string().min(1, "Clave p256dh requerida"),
    auth: z.string().min(1, "Clave auth requerida"),
  }),
});

/**
 * POST /api/push/subscribe — Guarda la suscripción push del profesional.
 * El profesional se suscribe desde su panel para recibir notificaciones
 * cuando un paciente reserva un turno.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parsed = pushSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parsed.data;

    // Upsert: si ya existe una suscripción con el mismo endpoint, actualizarla
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("Error guardando push subscription:", error);
      return NextResponse.json(
        { error: "Error al guardar la suscripción" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Suscripción guardada" }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/push/subscribe:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe — Elimina la suscripción push del profesional.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const { endpoint } = body as { endpoint?: string };

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 });
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error("Error eliminando push subscription:", error);
      return NextResponse.json(
        { error: "Error al eliminar la suscripción" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Suscripción eliminada" });
  } catch (error) {
    console.error("Error DELETE /api/push/subscribe:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
