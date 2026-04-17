import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { ScheduleConfig, WorkingHour, ScheduleBlock, Appointment } from "@/types";

interface Slot {
  start: string;
  end: string;
  // Modalidad permitida por la franja horaria donde cae este slot.
  // Si es 'both', el cliente puede elegir. Si es 'presencial' o 'virtual', está fijada.
  modality: "presencial" | "virtual" | "both";
}

interface SlotsResponse {
  slots: Slot[];
  meta: {
    date: string;
    duration: number;
    workingHours: { start: string; end: string } | null;
    vacationMode: boolean;
  };
}

/**
 * GET /api/schedule/available-slots
 *
 * Fetch available time slots for a professional on a given date.
 * This endpoint is PUBLIC (no auth required) for patient booking flows.
 *
 * Query parameters:
 *   - professionalId (required): UUID of the professional
 *   - date (required): ISO date string (e.g., "2026-04-03")
 *   - serviceId (optional): UUID of service to get its duration
 *   - duration (optional): minutes for slot duration (default: slot_duration from config)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get("professionalId");
    const date = searchParams.get("date");
    console.log("[AVAILABLE-SLOTS] Request:", { professionalId, date });
    const serviceId = searchParams.get("serviceId");
    const durationParam = searchParams.get("duration");
    // Modalidad explícita (cuando no hay serviceId). Para el flujo del profesional
    // que elige "presencial" o "virtual" antes de cargar servicio.
    const modalityParam = searchParams.get("modality") as
      | "presencial"
      | "virtual"
      | "both"
      | null;

    // Validate required parameters
    if (!professionalId || !date) {
      return NextResponse.json(
        {
          error: "Missing required parameters: professionalId and date",
        },
        { status: 400 }
      );
    }

    // Validate date format (ISO string)
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        {
          error: "Invalid date format. Use ISO format (e.g., 2026-04-03)",
        },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (this is a public booking endpoint)
    const supabase = createAdminClient();
    console.log("[AVAILABLE-SLOTS] Admin client created, SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env["SUPABASE_SERVICE_ROLE_KEY"]);

    // Fetch professional's schedule configuration
    const { data: config, error: configError } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("professional_id", professionalId)
      .single();

    console.log("[AVAILABLE-SLOTS] Config:", config ? "OK" : "NULL", configError?.message || "");

    if (configError || !config) {
      return NextResponse.json(
        {
          error: "Schedule configuration not found for this professional",
        },
        { status: 404 }
      );
    }

    // Check vacation mode (desde/hasta)
    if (config.vacation_mode) {
      const vacFrom = config.vacation_from ? new Date(config.vacation_from) : null;
      const vacUntil = config.vacation_until ? new Date(config.vacation_until) : null;
      const isInVacation =
        (!vacFrom && !vacUntil) ||
        (!vacFrom && vacUntil && targetDate <= vacUntil) ||
        (vacFrom && !vacUntil && targetDate >= vacFrom) ||
        (vacFrom && vacUntil && targetDate >= vacFrom && targetDate <= vacUntil);
      if (isInVacation) {
        return NextResponse.json({
          slots: [],
          meta: {
            date: date,
            duration: durationParam ? parseInt(durationParam) : config.slot_duration || 30,
            workingHours: null,
            vacationMode: true,
          },
        } as SlotsResponse);
      }
    }

    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = targetDate.getUTCDay();

    // Check if this day is a working day
    if (!config.working_days?.includes(dayOfWeek)) {
      return NextResponse.json({
        slots: [],
        meta: {
          date: date,
          duration: durationParam ? parseInt(durationParam) : config.slot_duration || 30,
          workingHours: null,
          vacationMode: false,
        },
      } as SlotsResponse);
    }

    // Fetch ALL working hours for this day of week (puede haber múltiples franjas, ej: mañana y tarde)
    const { data: workingHoursList, error: hoursError } = await supabase
      .from("working_hours")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("day_of_week", dayOfWeek)
      .order("start_time", { ascending: true });

    if (hoursError || !workingHoursList || workingHoursList.length === 0) {
      return NextResponse.json({
        slots: [],
        meta: {
          date: date,
          duration: durationParam ? parseInt(durationParam) : config.slot_duration || 30,
          workingHours: null,
          vacationMode: false,
        },
      } as SlotsResponse);
    }

    // Determine slot duration AND modality to filter by
    let slotDuration = config.slot_duration || 30;
    let serviceModality: "presencial" | "virtual" | "both" | null =
      modalityParam ?? null;

    if (serviceId) {
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("duration_minutes, modality")
        .eq("id", serviceId)
        .eq("professional_id", professionalId)
        .single();

      if (serviceError || !service) {
        return NextResponse.json(
          {
            error: "Service not found for this professional",
          },
          { status: 404 }
        );
      }

      slotDuration = service.duration_minutes || slotDuration;
      // La modalidad del servicio tiene prioridad sobre la del query param
      serviceModality = (service as { modality?: "presencial" | "virtual" | "both" }).modality ?? serviceModality;
    } else if (durationParam) {
      const parsed = parseInt(durationParam);
      if (!isNaN(parsed) && parsed > 0) {
        slotDuration = parsed;
      }
    }

    // Filtrar working_hours por compatibilidad de modalidad
    // - Service "presencial" → solo franjas presencial o both
    // - Service "virtual"    → solo franjas virtual o both
    // - Service "both" o sin modalidad → todas las franjas
    const filteredWorkingHours = serviceModality && serviceModality !== "both"
      ? workingHoursList.filter((wh) => {
          const whModality = (wh as { modality?: string }).modality ?? "both";
          return whModality === "both" || whModality === serviceModality;
        })
      : workingHoursList;

    // Si después del filtro no queda ninguna franja, no hay disponibilidad
    if (filteredWorkingHours.length === 0) {
      return NextResponse.json({
        slots: [],
        meta: {
          date: date,
          duration: slotDuration,
          workingHours: null,
          vacationMode: false,
        },
      } as SlotsResponse);
    }

    // Fetch appointments y blocks en paralelo (antes era secuencial)
    const nextDay = new Date(targetDate.getTime() + 86400000).toISOString().split("T")[0];
    const [appointmentsResult, blocksResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("starts_at, ends_at")
        .eq("professional_id", professionalId)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", date + "T00:00:00Z")
        .lt("starts_at", nextDay + "T00:00:00Z")
        .order("starts_at", { ascending: true }),
      supabase
        .from("schedule_blocks")
        .select("starts_at, ends_at")
        .eq("professional_id", professionalId)
        .gte("starts_at", date + "T00:00:00Z")
        .lt("starts_at", nextDay + "T00:00:00Z")
        .order("starts_at", { ascending: true }),
    ]);

    if (appointmentsResult.error) {
      console.error("Error fetching appointments:", appointmentsResult.error);
      return NextResponse.json(
        { error: "Error fetching appointments" },
        { status: 500 }
      );
    }

    if (blocksResult.error) {
      console.error("Error fetching blocks:", blocksResult.error);
      return NextResponse.json(
        { error: "Error fetching schedule blocks" },
        { status: 500 }
      );
    }

    const appointments = appointmentsResult.data;
    const blocks = blocksResult.data;

    // Helper: crear Date a partir de hora local Argentina (UTC-3)
    // Los horarios en working_hours están en hora local, no UTC.
    const AR_OFFSET = "-03:00";
    const toArgDate = (dateStr: string, hour: number, min: number): Date => {
      const hh = String(hour).padStart(2, "0");
      const mm = String(min).padStart(2, "0");
      return new Date(`${dateStr}T${hh}:${mm}:00${AR_OFFSET}`);
    };

    // Generate all potential slots from ALL working hour ranges
    const allSlots: Slot[] = [];

    for (const wh of filteredWorkingHours) {
      const [startHour, startMin] = wh.start_time.split(":").map(Number);
      const [endHour, endMin] = wh.end_time.split(":").map(Number);

      const rangeStart = toArgDate(date, startHour, startMin);
      const rangeEnd = toArgDate(date, endHour, endMin);
      const rangeModality =
        ((wh as { modality?: "presencial" | "virtual" | "both" }).modality ?? "both");

      let currentTime = new Date(rangeStart);

      while (currentTime < rangeEnd) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

        if (slotEnd <= rangeEnd) {
          allSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            modality: rangeModality,
          });
        }

        currentTime = slotEnd;
      }
    }

    // Pre-convertir todas las fechas a timestamps una sola vez (O(n+m) en vez de O(n*m))
    // Esto evita crear miles de objetos Date dentro del filter loop.
    const aptRanges = (appointments ?? []).map((a) => ({
      start: new Date(a.starts_at).getTime(),
      end: new Date(a.ends_at).getTime(),
    }));
    const blockRanges = (blocks ?? []).map((b) => ({
      start: new Date(b.starts_at).getTime(),
      end: new Date(b.ends_at).getTime(),
    }));

    // Pre-calcular lunch break una vez (antes se calculaba por cada slot)
    let lunchStartTs = 0;
    let lunchEndTs = 0;
    const hasLunch = !!(config.lunch_break_start && config.lunch_break_end);
    if (hasLunch) {
      const [lsh, lsm] = config.lunch_break_start!.split(":").map(Number);
      const [leh, lem] = config.lunch_break_end!.split(":").map(Number);
      lunchStartTs = toArgDate(date, lsh, lsm).getTime();
      lunchEndTs = toArgDate(date, leh, lem).getTime();
    }

    // Filtrar slots con comparaciones numéricas puras (mucho más rápido)
    const availableSlots = allSlots.filter((slot) => {
      const ss = new Date(slot.start).getTime();
      const se = new Date(slot.end).getTime();

      // Check lunch break
      if (hasLunch && ss < lunchEndTs && se > lunchStartTs) return false;

      // Check appointments — como están ordenados por starts_at, podemos usar early exit
      for (const apt of aptRanges) {
        if (apt.start >= se) break; // los siguientes también están después → salir
        if (ss < apt.end && se > apt.start) return false;
      }

      // Check blocks — igual, ordenados
      for (const blk of blockRanges) {
        if (blk.start >= se) break;
        if (ss < blk.end && se > blk.start) return false;
      }

      return true;
    });

    // Para el meta, usar la primera y última franja horaria (ya filtrada)
    const firstWh = filteredWorkingHours[0];
    const lastWh = filteredWorkingHours[filteredWorkingHours.length - 1];

    return NextResponse.json({
      slots: availableSlots,
      meta: {
        date: date,
        duration: slotDuration,
        workingHours: {
          start: firstWh.start_time,
          end: lastWh.end_time,
        },
        vacationMode: false,
      },
    } as SlotsResponse);
  } catch (error) {
    console.error("[AVAILABLE-SLOTS] ERROR:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
