import { SupabaseClient } from "@supabase/supabase-js";
import { startOfToday, endOfToday, startOfWeek, endOfWeek, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Database } from "@/types/database";

export interface MiaResponse {
  message: string;
  action?: "confirm_create" | "confirm_cancel" | "confirm_block" | "none";
  data?: Record<string, unknown>;
}

// Formatea una fecha en estilo argentino (dd/mm/yyyy)
function formatDateAR(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "dd/MM/yyyy", { locale: es });
  } catch {
    return dateStr;
  }
}

// Formatea una fecha en formato largo
function formatDateLong(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "EEEE dd 'de' MMMM", { locale: es });
  } catch {
    return dateStr;
  }
}

// Consulta turnos del día actual
export async function handleQueryToday(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MiaResponse> {
  const today = startOfToday();
  const endToday = endOfToday();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `id, starts_at, ends_at, status, notes,
       patient:patients(id, full_name),
       service:services(id, name)`
    )
    .eq("professional_id", userId)
    .gte("starts_at", today.toISOString())
    .lte("starts_at", endToday.toISOString())
    .in("status", ["confirmed", "pending"])
    .order("starts_at", { ascending: true });

  if (error) {
    return {
      message: "No pude obtener tus turnos. Intenta de nuevo.",
      action: "none",
    };
  }

  if (!data || data.length === 0) {
    return {
      message: "Hoy no tenés turnos registrados. 📅",
      action: "none",
    };
  }

  let message = `Hoy tenés ${data.length} turno${data.length !== 1 ? "s" : ""}:\n`;
  data.forEach((apt) => {
    const time = format(parseISO(apt.starts_at), "HH:mm");
    const patientName = (apt.patient as any)?.full_name || "Paciente";
    const serviceName = (apt.service as any)?.name || "Turno";
    message += `• ${time} - ${patientName} (${serviceName})\n`;
  });

  return {
    message: message.trim(),
    action: "none",
  };
}

// Consulta turnos de la semana actual
export async function handleQueryWeek(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MiaResponse> {
  const startWeek = startOfWeek(startOfToday(), { weekStartsOn: 1 }); // Lunes
  const endWeek = endOfWeek(startOfToday(), { weekStartsOn: 1 });

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `id, starts_at, ends_at, status,
       patient:patients(id, full_name),
       service:services(id, name)`
    )
    .eq("professional_id", userId)
    .gte("starts_at", startWeek.toISOString())
    .lte("starts_at", endWeek.toISOString())
    .in("status", ["confirmed", "pending"])
    .order("starts_at", { ascending: true });

  if (error) {
    return {
      message: "No pude obtener tus turnos. Intenta de nuevo.",
      action: "none",
    };
  }

  if (!data || data.length === 0) {
    return {
      message: "Esta semana no tenés turnos registrados. 📅",
      action: "none",
    };
  }

  let message = `Esta semana tenés ${data.length} turno${data.length !== 1 ? "s" : ""}:\n`;
  data.forEach((apt) => {
    const date = format(parseISO(apt.starts_at), "EEEE dd", { locale: es });
    const time = format(parseISO(apt.starts_at), "HH:mm");
    const patientName = (apt.patient as any)?.full_name || "Paciente";
    const serviceName = (apt.service as any)?.name || "Turno";
    message += `• ${date} ${time} - ${patientName} (${serviceName})\n`;
  });

  return {
    message: message.trim(),
    action: "none",
  };
}

// Consulta turnos de una fecha específica
export async function handleQueryDate(
  supabase: SupabaseClient<Database>,
  userId: string,
  dateStr: string
): Promise<MiaResponse> {
  if (!dateStr) {
    return {
      message: "Necesito una fecha para consultar. Por ejemplo: 'turnos del 15 de abril'.",
      action: "none",
    };
  }

  const date = parseISO(dateStr);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `id, starts_at, ends_at, status,
       patient:patients(id, full_name),
       service:services(id, name)`
    )
    .eq("professional_id", userId)
    .gte("starts_at", date.toISOString())
    .lte("starts_at", endDate.toISOString())
    .in("status", ["confirmed", "pending"])
    .order("starts_at", { ascending: true });

  if (error) {
    return {
      message: "No pude obtener tus turnos. Intenta de nuevo.",
      action: "none",
    };
  }

  const dateFormatted = formatDateLong(dateStr);

  if (!data || data.length === 0) {
    return {
      message: `El ${dateFormatted} no tenés turnos registrados. 📅`,
      action: "none",
    };
  }

  let message = `El ${dateFormatted} tenés ${data.length} turno${data.length !== 1 ? "s" : ""}:\n`;
  data.forEach((apt) => {
    const time = format(parseISO(apt.starts_at), "HH:mm");
    const patientName = (apt.patient as any)?.full_name || "Paciente";
    const serviceName = (apt.service as any)?.name || "Turno";
    message += `• ${time} - ${patientName} (${serviceName})\n`;
  });

  return {
    message: message.trim(),
    action: "none",
  };
}

// Consulta el próximo turno
export async function handleQueryNext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MiaResponse> {
  const now = new Date();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `id, starts_at, ends_at, status,
       patient:patients(id, full_name),
       service:services(id, name)`
    )
    .eq("professional_id", userId)
    .gte("starts_at", now.toISOString())
    .in("status", ["confirmed", "pending"])
    .order("starts_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    return {
      message: "No tenés próximos turnos registrados. 📅",
      action: "none",
    };
  }

  const date = formatDateLong(data.starts_at);
  const time = format(parseISO(data.starts_at), "HH:mm");
  const patientName = (data.patient as any)?.full_name || "Paciente";
  const serviceName = (data.service as any)?.name || "Turno";

  return {
    message: `Tu próximo turno es: ${date} a las ${time} con ${patientName} (${serviceName}). 🕐`,
    action: "none",
  };
}

// Prepara la creación de un turno (pide confirmación)
export async function handleCreateAppointment(
  supabase: SupabaseClient<Database>,
  userId: string,
  entities: {
    date?: string;
    time?: string;
    patientName?: string;
    reason?: string;
  }
): Promise<MiaResponse> {
  // Validar que tengamos al menos fecha y hora
  if (!entities.date || !entities.time) {
    return {
      message:
        "Para agendar un turno necesito: fecha (ej: mañana, lunes), hora (ej: 10:00) y nombre del paciente. ¿Qué día y hora te va bien?",
      action: "none",
    };
  }

  if (!entities.patientName) {
    return {
      message: "¿A qué paciente le agendo el turno?",
      action: "none",
    };
  }

  // Busca el paciente por nombre
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("professional_id", userId)
    .ilike("full_name", `%${entities.patientName}%`)
    .limit(1);

  if (!patients || patients.length === 0) {
    return {
      message: `No encontré un paciente llamado "${entities.patientName}". ¿Es un paciente nuevo? Necesito crearlo primero. 👤`,
      action: "none",
    };
  }

  const patient = patients[0]!;

  // Construye la fecha y hora del turno
  const dateObj = parseISO(entities.date);
  const [hours, minutes] = entities.time!.split(":").map(Number);
  dateObj.setHours(hours, minutes, 0, 0);
  const startsAt = dateObj.toISOString();

  // Asume duración de 30 minutos por defecto
  const endsAt = new Date(dateObj);
  endsAt.setMinutes(endsAt.getMinutes() + 30);

  const dateFormatted = formatDateLong(entities.date);

  return {
    message: `Entendí: querés agendar un turno para ${patient.full_name} el ${dateFormatted} a las ${entities.time}. ¿Confirmo? 📅`,
    action: "confirm_create",
    data: {
      patient_id: patient.id,
      starts_at: startsAt,
      ends_at: endsAt.toISOString(),
      reason: entities.reason,
    },
  };
}

// Prepara la cancelación de un turno (pide confirmación)
export async function handleCancelAppointment(
  supabase: SupabaseClient<Database>,
  userId: string,
  entities: {
    time?: string;
    date?: string;
    patientName?: string;
  }
): Promise<MiaResponse> {
  if (!entities.time) {
    return {
      message:
        "¿A qué hora es el turno que querés cancelar? Por ejemplo: 'cancelá el turno de las 14:00'.",
      action: "none",
    };
  }

  // Busca turnos confirmados a esa hora
  let query = supabase
    .from("appointments")
    .select(
      `id, starts_at, status,
       patient:patients(id, full_name)`
    )
    .eq("professional_id", userId)
    .in("status", ["confirmed", "pending"]);

  // Si tenemos fecha, filtra por ella
  if (entities.date) {
    const dateObj = parseISO(entities.date);
    const endDate = new Date(dateObj);
    endDate.setHours(23, 59, 59, 999);
    query = query
      .gte("starts_at", dateObj.toISOString())
      .lte("starts_at", endDate.toISOString());
  } else {
    // Si no, busca en los próximos días
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    query = query.gte("starts_at", now.toISOString()).lte("starts_at", in7Days.toISOString());
  }

  const { data: appointments } = await query.order("starts_at", { ascending: true });

  if (!appointments || appointments.length === 0) {
    return {
      message: "No encontré un turno a esa hora para cancelar. 🤔",
      action: "none",
    };
  }

  // Si hay múltiples resultados, busca coincidencia con nombre de paciente
  let targetAppointment = appointments[0]!;
  if (appointments.length > 1 && entities.patientName) {
    const match = appointments.find(
      (apt) =>
        (apt.patient as any)?.full_name
          ?.toLowerCase()
          .includes(entities.patientName!.toLowerCase())
    );
    if (match) {
      targetAppointment = match;
    }
  }

  const patientName = (targetAppointment.patient as any)?.full_name || "Paciente";
  const dateObj = parseISO(targetAppointment.starts_at);
  const dateFormatted = formatDateLong(targetAppointment.starts_at);
  const time = format(dateObj, "HH:mm");

  return {
    message: `Voy a cancelar el turno de ${patientName} el ${dateFormatted} a las ${time}. ¿Confirmo? ❌`,
    action: "confirm_cancel",
    data: {
      appointment_id: targetAppointment.id,
      reason: "Cancelado por profesional a través de MIA",
    },
  };
}

// Prepara el bloqueo de horarios (pide confirmación)
export async function handleBlockSchedule(
  supabase: SupabaseClient<Database>,
  userId: string,
  entities: {
    date?: string;
    time?: string;
  }
): Promise<MiaResponse> {
  if (!entities.date) {
    return {
      message: "¿Qué día querés bloquear? Por ejemplo: 'bloqueá el viernes'.",
      action: "none",
    };
  }

  const dateObj = parseISO(entities.date);
  let startsAt = dateObj;
  let endsAt = new Date(dateObj);
  endsAt.setHours(23, 59, 59, 999);

  // Si especifica una hora, bloquea desde esa hora
  if (entities.time) {
    const [hours, minutes] = entities.time.split(":").map(Number);
    startsAt = new Date(dateObj);
    startsAt.setHours(hours, minutes, 0, 0);
    endsAt = new Date(startsAt);
    endsAt.setHours(23, 59, 59, 999);
  }

  const dateFormatted = formatDateLong(entities.date);

  return {
    message: `Voy a bloquear el ${dateFormatted} ${entities.time ? `desde las ${entities.time}` : "todo el día"}. ¿Confirmo? 🚫`,
    action: "confirm_block",
    data: {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason: "Bloqueado por profesional a través de MIA",
    },
  };
}

// Consulta cantidad de pacientes
export async function handleQueryPatients(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MiaResponse> {
  const { data: patients, error } = await supabase
    .from("patients")
    .select("id, full_name, created_at")
    .eq("professional_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !patients) {
    return {
      message: "No pude obtener tu lista de pacientes. Intenta de nuevo.",
      action: "none",
    };
  }

  if (patients.length === 0) {
    return {
      message: "Aún no tenés pacientes registrados.",
      action: "none",
    };
  }

  let message = `Tenés ${patients.length} paciente${patients.length !== 1 ? "s" : ""} registrado${patients.length !== 1 ? "s" : ""}:\n`;
  patients.slice(0, 5).forEach((patient) => {
    message += `• ${patient.full_name}\n`;
  });

  return {
    message: message.trim(),
    action: "none",
  };
}

// Consulta estadísticas del mes
export async function handleQueryStats(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<MiaResponse> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endMonth.setHours(23, 59, 59, 999);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, status, created_at")
    .eq("professional_id", userId)
    .gte("created_at", startMonth.toISOString())
    .lte("created_at", endMonth.toISOString());

  if (error || !appointments) {
    return {
      message: "No pude obtener tus estadísticas. Intenta de nuevo.",
      action: "none",
    };
  }

  const total = appointments.length;
  const confirmed = appointments.filter((a) => a.status === "confirmed").length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const cancelled = appointments.filter((a) => a.status === "cancelled").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  const monthName = format(startMonth, "MMMM", { locale: es });

  let message = `Estadísticas de ${monthName}:\n`;
  message += `• Total de turnos: ${total}\n`;
  message += `• Confirmados: ${confirmed}\n`;
  message += `• Pendientes: ${pending}\n`;
  message += `• Completados: ${completed}\n`;
  message += `• Cancelados: ${cancelled}`;

  return {
    message: message.trim(),
    action: "none",
  };
}

// Respuesta a saludo
export function handleGreeting(userName: string): MiaResponse {
  const greetings = [
    `¡Hola ${userName}! 👋 Soy MIA, tu asistente de agenda. ¿Qué necesitás?`,
    `¡Hola ${userName}! 😊 Estoy acá para ayudarte con tu agenda y turnos.`,
    `¡Buen día ${userName}! 🌟 ¿Qué hacemos hoy?`,
  ];

  const message = greetings[Math.floor(Math.random() * greetings.length)]!;

  return {
    message,
    action: "none",
  };
}

// Respuesta a solicitud de ayuda
export function handleHelp(): MiaResponse {
  const message = `Acá estoy para ayudarte. Puedo:

📅 **Consultar tu agenda:**
• "¿Qué turnos tengo hoy?"
• "¿Qué turnos tengo esta semana?"
• "¿Cuál es mi próximo turno?"

📝 **Gestionar turnos:**
• "Agendá un turno para Juan Pérez mañana a las 10"
• "Cancelá el turno de las 15:00"
• "Bloqueá el viernes"

📊 **Información:**
• "¿Cuántos pacientes tengo?"
• "¿Cuántos turnos tuve este mes?"

¿Qué querés hacer?`;

  return {
    message,
    action: "none",
  };
}
