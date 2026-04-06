import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Esquema de validación para parámetros
const metricsParamsSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Formato inválido. Use YYYY-MM").optional(),
});

// Tipos para las métricas de respuesta
interface AppointmentMetrics {
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
  pending: number;
}

interface ComparisonMetrics {
  total_prev: number;
  change_pct: number;
}

interface DailyData {
  date: string;
  count: number;
}

interface ServiceData {
  service_name: string;
  count: number;
  revenue: number;
}

interface TopPatientData {
  name: string;
  appointments: number;
}

interface OccupancyData {
  available_slots: number;
  booked_slots: number;
  rate: number;
}

interface MetricsResponse {
  period: string;
  appointments: AppointmentMetrics;
  comparison: ComparisonMetrics;
  daily: DailyData[];
  byService: ServiceData[];
  topPatients: TopPatientData[];
  occupancy: OccupancyData;
}

// GET /api/metrics — Métricas del profesional autenticado
export async function GET(request: NextRequest): Promise<NextResponse<MetricsResponse | { error: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");

    // Obtener período actual o el especificado
    const now = new Date();
    let period: string;
    let periodStart: Date;
    let periodEnd: Date;

    if (periodParam) {
      const parsed = metricsParamsSchema.safeParse({ period: periodParam });
      if (!parsed.success) {
        return NextResponse.json({ error: "Parámetro period inválido (YYYY-MM)" }, { status: 400 });
      }
      period = parsed.data.period!;
      const [year, month] = period.split("-").map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0, 23, 59, 59);
    } else {
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const periodStartISO = periodStart.toISOString();
    const periodEndISO = periodEnd.toISOString();

    // Calcular período anterior (mes anterior)
    const prevStart = new Date(periodStart);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(prevStart);
    prevEnd.setMonth(prevEnd.getMonth() + 1);
    prevEnd.setDate(0);
    prevEnd.setHours(23, 59, 59);

    const prevStartISO = prevStart.toISOString();
    const prevEndISO = prevEnd.toISOString();

    // Ejecutar todas las queries en paralelo para mayor velocidad
    const [appointmentsResult, prevAppointmentsResult, scheduleConfigResult, workingHoursResult] = await Promise.allSettled([
      // 1. Turnos del período actual
      supabase
        .from("appointments")
        .select(
          `id, status, starts_at, patient_id, service_id,
           patient:patients(id, full_name),
           service:services(id, name, price)`
        )
        .eq("professional_id", user.id)
        .gte("starts_at", periodStartISO)
        .lte("starts_at", periodEndISO)
        .order("starts_at", { ascending: true }),

      // 2. Turnos del período anterior (comparación)
      supabase
        .from("appointments")
        .select("id, status")
        .eq("professional_id", user.id)
        .gte("starts_at", prevStartISO)
        .lte("starts_at", prevEndISO),

      // 3. Config de horarios
      supabase
        .from("schedule_configs")
        .select("working_days, slot_duration")
        .eq("professional_id", user.id)
        .maybeSingle(),

      // 4. Horarios de trabajo
      supabase
        .from("working_hours")
        .select("day_of_week, start_time, end_time")
        .eq("professional_id", user.id),
    ]);

    type AppointmentRow = {
      id: string; status: string; starts_at: string;
      patient_id: string; service_id: string | null;
      patient: { id: string; full_name: string } | null;
      service: { id: string; name: string; price: number | null } | null;
    };

    let appointments: AppointmentRow[] = [];
    if (appointmentsResult.status === "fulfilled" && !appointmentsResult.value.error) {
      appointments = (appointmentsResult.value.data || []) as AppointmentRow[];
    } else {
      console.error("Error fetching appointments:", appointmentsResult.status === "fulfilled" ? appointmentsResult.value.error?.message : appointmentsResult.reason);
    }

    let prevAppointments: Array<{ id: string; status: string }> = [];
    if (prevAppointmentsResult.status === "fulfilled" && !prevAppointmentsResult.value.error) {
      prevAppointments = prevAppointmentsResult.value.data || [];
    }

    const scheduleConfig = scheduleConfigResult.status === "fulfilled" ? scheduleConfigResult.value.data : null;
    const workingHours = workingHoursResult.status === "fulfilled" ? workingHoursResult.value.data : null;

    // ────────────────────────────────────────────────────────────────
    // Procesar datos para las métricas
    // ────────────────────────────────────────────────────────────────

    // Contar turnos por estado
    const appointmentsByStatus: Record<AppointmentStatus, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };

    appointments.forEach((apt) => {
      appointmentsByStatus[apt.status as AppointmentStatus]++;
    });

    const appointmentMetrics: AppointmentMetrics = {
      total: appointments.length,
      confirmed: appointmentsByStatus.confirmed,
      completed: appointmentsByStatus.completed,
      cancelled: appointmentsByStatus.cancelled,
      no_show: appointmentsByStatus.no_show,
      pending: appointmentsByStatus.pending,
    };

    // Comparación con mes anterior
    const totalPrev = prevAppointments.length;
    const totalCurrent = appointmentMetrics.total;
    const changePct = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : 0;

    const comparison: ComparisonMetrics = {
      total_prev: totalPrev,
      change_pct: Math.round(changePct * 10) / 10, // 1 decimal
    };

    // Agrupar por día (para gráfico diario)
    const dailyMap = new Map<string, number>();
    appointments.forEach((apt) => {
      const date = new Date(apt.starts_at).toISOString().split("T")[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });

    const daily: DailyData[] = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por servicio (con nombre y precio)
    const serviceMap = new Map<string, { name: string; count: number; revenue: number }>();
    appointments.forEach((apt) => {
      if (apt.service) {
        const key = apt.service.id;
        const current = serviceMap.get(key) || { name: apt.service.name, count: 0, revenue: 0 };
        current.count++;
        if (apt.service.price) {
          current.revenue += apt.service.price;
        }
        serviceMap.set(key, current);
      }
    });

    const byService: ServiceData[] = Array.from(serviceMap.values()).sort(
      (a, b) => b.count - a.count
    );

    // Top 5 pacientes (por cantidad de turnos)
    const patientMap = new Map<string, { name: string; count: number }>();
    appointments.forEach((apt) => {
      if (apt.patient) {
        const key = apt.patient.id;
        const current = patientMap.get(key) || { name: apt.patient.full_name, count: 0 };
        current.count++;
        patientMap.set(key, current);
      }
    });

    const topPatients: TopPatientData[] = Array.from(patientMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calcular ocupación
    // Slots disponibles = suma de horas disponibles en el mes * 60 / slot_duration
    const occupancy = calculateOccupancy(
      periodStart,
      periodEnd,
      scheduleConfig?.working_days || [1, 2, 3, 4, 5],
      workingHours || [],
      scheduleConfig?.slot_duration || 30,
      appointmentMetrics.total
    );

    const metricsResponse: MetricsResponse = {
      period,
      appointments: appointmentMetrics,
      comparison,
      daily,
      byService,
      topPatients,
      occupancy,
    };

    return NextResponse.json(metricsResponse);
  } catch (error) {
    console.error("Error GET /api/metrics:", error);
    // Devolver 500 en vez de dejar que Next.js devuelva 503 por timeout
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno al procesar métricas" },
      { status: 500 }
    );
  }
}

/**
 * Calcula la ocupación basándose en horarios de trabajo configurados
 */
function calculateOccupancy(
  periodStart: Date,
  periodEnd: Date,
  workingDays: number[],
  workingHours: Array<{ day_of_week: number; start_time: string; end_time: string }>,
  slotDuration: number,
  bookedSlots: number
): OccupancyData {
  let availableSlots = 0;

  // Iterar por cada día del período
  const current = new Date(periodStart);
  while (current <= periodEnd) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Verificar si este día está en los días de trabajo
    if (workingDays.includes(dayOfWeek)) {
      // Buscar horarios para este día
      const dayHours = workingHours.filter((wh) => wh.day_of_week === dayOfWeek);

      dayHours.forEach((wh) => {
        // Parsear horas de inicio y fin (formato HH:MM:SS)
        const [startHour, startMin] = wh.start_time.split(":").map(Number);
        const [endHour, endMin] = wh.end_time.split(":").map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const durationMinutes = endMinutes - startMinutes;

        // Calcular slots posibles en esta franja horaria
        const slotsInRange = Math.floor(durationMinutes / slotDuration);
        availableSlots += slotsInRange;
      });
    }

    current.setDate(current.getDate() + 1);
  }

  const rate = availableSlots > 0 ? Math.round((bookedSlots / availableSlots) * 1000) / 10 : 0; // 1 decimal

  return {
    available_slots: availableSlots,
    booked_slots: bookedSlots,
    rate,
  };
}
