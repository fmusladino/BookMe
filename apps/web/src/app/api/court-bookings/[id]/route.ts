import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/court-bookings/[id] — Actualiza estado de una reserva
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    console.log("[PATCH court-booking] id:", id);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[PATCH court-booking] no user");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (process.env.NODE_ENV !== "production") console.log("[PATCH court-booking] user authenticated");

    const body = await request.json();
    console.log("[PATCH court-booking] body:", JSON.stringify(body));

    // Validar campos permitidos
    const status = body.status as string | undefined;
    const seña_paid = body.seña_paid as boolean | undefined;
    const notes = body.notes as string | undefined;

    if (status && !["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verificar que la reserva existe y pertenece al dueño
    const { data: existing, error: findError } = await admin
      .from("court_bookings")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    console.log("[PATCH court-booking] existing:", existing, "findError:", findError);

    if (findError || !existing) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (existing.owner_id !== user.id) {
      return NextResponse.json({ error: "No autorizado para esta reserva" }, { status: 403 });
    }

    // Armar update solo con campos definidos
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (seña_paid !== undefined) updateData.seña_paid = seña_paid;
    if (notes !== undefined) updateData.notes = notes;

    console.log("[PATCH court-booking] updateData:", JSON.stringify(updateData));

    const { data: booking, error: updateError } = await admin
      .from("court_bookings")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    console.log("[PATCH court-booking] result:", booking ? "ok" : "null", "error:", updateError);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error("[PATCH court-booking] CATCH:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/court-bookings/[id] — Cancela una reserva
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("court_bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE court-booking]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
