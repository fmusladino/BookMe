import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

const bookingSchema = z.object({
  court_id: z.string().uuid("ID de cancha inválido"),
  customer_name: z.string().min(1, "El nombre es requerido"),
  customer_phone: z.string().optional(),
  customer_email: z.string().email("Email inválido").optional(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  start_time: z.string(),
  end_time: z.string(),
  notes: z.string().optional(),
});

/**
 * GET /api/court-bookings — Lista reservas
 *
 * Si el usuario NO está logueado y pasa court_id + date,
 * devuelve solo los horarios ocupados (sin datos personales).
 * Esto permite a la landing pública mostrar disponibilidad.
 *
 * Si el usuario está logueado (dueño), devuelve las reservas completas.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const courtId = url.searchParams.get("court_id");
    const date = url.searchParams.get("date");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // ─── Modo público: solo court_id + date, devuelve horarios ocupados ───
    if (!user && courtId && date) {
      const admin = createAdminClient();
      const { data: bookings, error } = await admin
        .from("court_bookings")
        .select("start_time, end_time, status")
        .eq("court_id", courtId)
        .eq("booking_date", date)
        .neq("status", "cancelled");

      if (error) throw error;

      return NextResponse.json({
        bookings: (bookings ?? []).map((b) => ({
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
        })),
      });
    }

    // ─── Modo autenticado: reservas completas del dueño ───
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let query = supabase
      .from("court_bookings")
      .select(`
        *,
        courts (id, name, sport, price_per_hour, seña_required, seña_amount, seña_alias)
      `)
      .eq("owner_id", user.id)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: true });

    if (status) query = query.eq("status", status);
    if (courtId) query = query.eq("court_id", courtId);
    if (date) query = query.eq("booking_date", date);

    const { data: bookings, error } = await query;
    if (error) throw error;

    return NextResponse.json({ bookings: bookings ?? [] });
  } catch (error) {
    console.error("GET /api/court-bookings:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/court-bookings — Crea una nueva reserva (público, sin auth requerida)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const body = (await request.json()) as unknown;
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { court_id, customer_name, customer_phone, customer_email, booking_date, start_time, end_time, notes } = parsed.data;

    // Obtener datos de la cancha para calcular el monto
    const { data: court, error: courtError } = await admin
      .from("courts")
      .select("id, owner_id, name, price_per_hour, seña_required, seña_amount, is_active")
      .eq("id", court_id)
      .eq("is_active", true)
      .single();

    if (courtError || !court) {
      return NextResponse.json({ error: "Cancha no encontrada o inactiva" }, { status: 404 });
    }

    // Calcular duración — el precio ya es por turno completo, no por hora
    const [sh, sm] = start_time.split(":").map(Number);
    const [eh, em] = end_time.split(":").map(Number);
    const durationHours = (((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
    const totalAmount = court.price_per_hour;

    // Verificar que no hay reservas superpuestas
    const { data: overlap } = await admin
      .from("court_bookings")
      .select("id")
      .eq("court_id", court_id)
      .eq("booking_date", booking_date)
      .neq("status", "cancelled")
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`)
      .limit(1);

    if (overlap && overlap.length > 0) {
      return NextResponse.json({ error: "El horario seleccionado ya está reservado" }, { status: 409 });
    }

    // Crear la reserva
    const { data: booking, error: bookingError } = await admin
      .from("court_bookings")
      .insert({
        court_id,
        owner_id: court.owner_id,
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        booking_date,
        start_time,
        end_time,
        duration_hours: durationHours,
        total_amount: totalAmount > 0 ? totalAmount : null,
        seña_amount: court.seña_required ? (court.seña_amount ?? null) : null,
        seña_paid: false,
        status: "pending",
        notes: notes || null,
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    return NextResponse.json(
      {
        booking,
        message: "Reserva creada exitosamente",
        seña_info: court.seña_required
          ? {
              required: true,
              amount: court.seña_amount,
              message: "Tu reserva está pendiente de confirmación. Enviá la seña para confirmar.",
            }
          : { required: false },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/court-bookings:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
