import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/courts/availability
 *
 * Genera un resumen de disponibilidad de hoy y mañana para todas las canchas
 * del dueño autenticado. Devuelve el texto formateado para WhatsApp.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();

    // Obtener datos del dueño
    const { data: owner } = await admin
      .from("court_owners")
      .select("business_name, slug, whatsapp")
      .eq("id", user.id)
      .single();

    if (!owner) {
      return NextResponse.json({ error: "No se encontró el perfil de canchas" }, { status: 404 });
    }

    // Obtener canchas activas con horarios
    const { data: courts } = await admin
      .from("courts")
      .select(`
        id, name, sport, price_per_hour, slot_duration,
        seña_required, seña_amount,
        court_schedules (day_of_week, start_time, end_time)
      `)
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("name");

    if (!courts || courts.length === 0) {
      return NextResponse.json({
        message: "No hay canchas activas",
        whatsapp_text: "",
      });
    }

    // Fechas: hoy y mañana
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dates = [
      { date: today, label: "HOY" },
      { date: tomorrow, label: "MAÑANA" },
    ];

    const DAYS_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    // Para cada fecha, obtener reservas de todas las canchas
    const availability: Array<{
      label: string;
      dateStr: string;
      dayName: string;
      courts: Array<{
        name: string;
        sport: string;
        price: number;
        slotDuration: number;
        señaInfo: string;
        freeSlots: string[];
        totalSlots: number;
      }>;
    }> = [];

    for (const { date, label } of dates) {
      const dateStr = date.toISOString().split("T")[0]!;
      const dayOfWeek = date.getDay();
      const dayName = DAYS_NAMES[dayOfWeek]!;

      const courtAvailability: typeof availability[0]["courts"] = [];

      for (const court of courts) {
        const schedules = (court.court_schedules as Array<{
          day_of_week: number;
          start_time: string;
          end_time: string;
        }>).filter((s) => s.day_of_week === dayOfWeek);

        if (schedules.length === 0) continue;

        const slotDuration = (court.slot_duration as number | null) ?? 60;

        // Generar todos los slots posibles
        const allSlots: string[] = [];
        for (const schedule of schedules) {
          const [sh, sm] = schedule.start_time.split(":").map(Number);
          const [eh, em] = schedule.end_time.split(":").map(Number);
          let current = (sh ?? 0) * 60 + (sm ?? 0);
          const end = (eh ?? 0) * 60 + (em ?? 0) - slotDuration;
          while (current <= end) {
            const h = Math.floor(current / 60).toString().padStart(2, "0");
            const m = (current % 60).toString().padStart(2, "0");
            allSlots.push(`${h}:${m}`);
            current += slotDuration;
          }
        }

        // Obtener reservas del día
        const { data: bookings } = await admin
          .from("court_bookings")
          .select("start_time")
          .eq("court_id", court.id)
          .eq("booking_date", dateStr)
          .neq("status", "cancelled");

        const bookedTimes = (bookings ?? []).map((b) =>
          (b.start_time as string).slice(0, 5)
        );

        // Filtrar slots pasados si es hoy
        const now = new Date();
        const freeSlots = allSlots.filter((slot) => {
          if (bookedTimes.includes(slot)) return false;
          if (label === "HOY") {
            const [h, m] = slot.split(":").map(Number);
            const slotTime = new Date(today);
            slotTime.setHours(h ?? 0, m ?? 0, 0, 0);
            return slotTime > now;
          }
          return true;
        });

        const señaInfo = court.seña_required
          ? `💰 Seña: $${((court.seña_amount as number | null) ?? 0).toLocaleString("es-AR")}`
          : "";

        courtAvailability.push({
          name: court.name,
          sport: court.sport,
          price: court.price_per_hour,
          slotDuration,
          señaInfo,
          freeSlots,
          totalSlots: allSlots.length,
        });
      }

      availability.push({
        label,
        dateStr,
        dayName,
        courts: courtAvailability,
      });
    }

    // Generar texto de WhatsApp
    const bookingUrl = `https://bookme.ar/complejos/${owner.slug}`;
    let text = `⚽ *${owner.business_name}*\n`;
    text += `📅 Disponibilidad de turnos\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const day of availability) {
      const dateFormatted = new Date(day.dateStr + "T12:00:00").toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
      });

      text += `📆 *${day.label} — ${day.dayName} ${dateFormatted}*\n\n`;

      if (day.courts.length === 0) {
        text += `_Sin horarios configurados para este día_\n\n`;
        continue;
      }

      for (const court of day.courts) {
        if (court.freeSlots.length === 0) {
          text += `🏟️ *${court.name}* (${court.sport})\n`;
          text += `❌ _Completa — sin turnos disponibles_\n\n`;
          continue;
        }

        text += `🏟️ *${court.name}* (${court.sport})\n`;
        text += `💲 $${court.price.toLocaleString("es-AR")} · ⏱️ ${court.slotDuration} min`;
        if (court.señaInfo) text += ` · ${court.señaInfo}`;
        text += `\n`;

        // Agrupar slots en una línea legible
        text += `✅ ${court.freeSlots.join(" · ")}\n`;
        text += `📊 ${court.freeSlots.length}/${court.totalSlots} disponibles\n\n`;
      }

      text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    text += `🔗 *Reservá online:*\n${bookingUrl}\n\n`;
    text += `_Enviado desde BookMe_`;

    return NextResponse.json({
      availability,
      whatsapp_text: text,
      booking_url: bookingUrl,
    });
  } catch (error) {
    console.error("GET /api/courts/availability:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
