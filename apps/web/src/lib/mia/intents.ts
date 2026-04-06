import {
  parseISO,
  startOfToday,
  startOfTomorrow,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  formatISO,
} from "date-fns";

export type MiaIntent =
  | "query_today"
  | "query_week"
  | "query_date"
  | "query_next"
  | "create_appointment"
  | "cancel_appointment"
  | "block_schedule"
  | "unblock_schedule"
  | "query_patients"
  | "query_stats"
  | "help"
  | "greeting"
  | "unknown";

export interface ParsedIntent {
  intent: MiaIntent;
  entities: {
    date?: string; // ISO date extracted
    time?: string; // HH:MM extracted
    patientName?: string;
    reason?: string;
    period?: "today" | "tomorrow" | "week" | "month";
  };
  raw: string;
}

// Palabras clave para detectar intents
const INTENT_KEYWORDS: Record<string, MiaIntent[]> = {
  // Query today
  hoy: ["query_today"],
  "hoy?": ["query_today"],

  // Query week
  semana: ["query_week"],
  "esta semana": ["query_week"],
  "está semana": ["query_week"],

  // Query next appointment
  próximo: ["query_next"],
  siguiente: ["query_next"],
  "próximo turno": ["query_next"],

  // Create appointment
  agend: ["create_appointment"],
  cre: ["create_appointment"],
  reserv: ["create_appointment"],
  sac: ["create_appointment"],
  "sacar turno": ["create_appointment"],
  "nuevo turno": ["create_appointment"],

  // Cancel appointment
  cancel: ["cancel_appointment"],
  elimin: ["cancel_appointment"],
  borr: ["cancel_appointment"],
  cancela: ["cancel_appointment"],

  // Block schedule
  bloque: ["block_schedule"],
  bloquea: ["block_schedule"],
  "no disponible": ["block_schedule"],

  // Unblock schedule
  desbloque: ["unblock_schedule"],
  desbloquea: ["unblock_schedule"],

  // Query patients
  paciente: ["query_patients"],
  pacientes: ["query_patients"],
  "cuántos pacientes": ["query_patients"],

  // Query stats
  "estadístic": ["query_stats"],
  métric: ["query_stats"],
  "cuántos turnos": ["query_stats"],
  total: ["query_stats"],

  // Help
  ayuda: ["help"],
  "qué pod": ["help"],
  "qué sab": ["help"],
  "qué puedes": ["help"],
  capaz: ["help"],

  // Greeting
  hola: ["greeting"],
  buen: ["greeting"],
  hey: ["greeting"],
  "buenos días": ["greeting"],
  "buenas tardes": ["greeting"],
  "buenas noches": ["greeting"],
};

// Extrae fechas en texto natural
function extractDate(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  const today = startOfToday();

  // Palabras clave para fechas
  if (lowerText.includes("mañana")) {
    return formatISO(startOfTomorrow(), { representation: "date" });
  }

  if (lowerText.includes("hoy")) {
    return formatISO(today, { representation: "date" });
  }

  // Días de la semana
  const dayMap: Record<string, (date: Date) => Date> = {
    lunes: nextMonday,
    martes: nextTuesday,
    miércoles: nextWednesday,
    miercoles: nextWednesday,
    jueves: nextThursday,
    viernes: nextFriday,
    sábado: nextSaturday,
    sabado: nextSaturday,
    domingo: nextSunday,
  };

  for (const [day, fn] of Object.entries(dayMap)) {
    if (lowerText.includes(day)) {
      return formatISO(fn(today), { representation: "date" });
    }
  }

  // Intenta parsear fechas en formato DD/MM/YYYY o DD-MM-YYYY
  const dateRegex = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
  const match = text.match(dateRegex);
  if (match) {
    const [, day, month, year] = match;
    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return formatISO(date, { representation: "date" });
    } catch {
      // Ignorar si no se puede parsear
    }
  }

  return undefined;
}

// Extrae hora en formato HH:MM
function extractTime(text: string): string | undefined {
  // Busca patrones "a las HH:MM", "a las HH", "HH:MM", etc.
  const timeRegex = /(?:a las |las )?(\d{1,2}):?(\d{2})?/;
  const match = text.match(timeRegex);

  if (match) {
    const hour = match[1];
    const minute = match[2] || "00";
    return `${hour.padStart(2, "0")}:${minute}`;
  }

  // Palabras clave para horas
  if (text.includes("mañana")) {
    return "09:00";
  }
  if (text.includes("tarde")) {
    return "14:00";
  }
  if (text.includes("noche")) {
    return "19:00";
  }

  return undefined;
}

// Extrae el nombre del paciente (después de "para" o "de")
function extractPatientName(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  // Busca "para [Nombre]"
  const paraMatch = text.match(/para\s+([A-Z][a-záéíóúñ\s]+)/i);
  if (paraMatch) {
    return paraMatch[1].trim();
  }

  // Busca "de [Nombre]" (para cancelación)
  const deMatch = text.match(/de\s+(?:las\s+)?\d{1,2}:?\d{2}?\s+(?:de\s+)?([A-Z][a-záéíóúñ\s]+)?/i);
  if (deMatch && deMatch[1]) {
    return deMatch[1].trim();
  }

  // Busca "del [Nombre]"
  const delMatch = text.match(/del\s+([A-Z][a-záéíóúñ\s]+)/i);
  if (delMatch) {
    return delMatch[1].trim();
  }

  return undefined;
}

// Parsea el intent y extrae entidades
export function parseIntent(message: string): ParsedIntent {
  const lowerMessage = message.toLowerCase();
  let detectedIntent: MiaIntent = "unknown";
  let confidence = 0;

  // Busca keywords para detectar intent
  for (const [keyword, intents] of Object.entries(INTENT_KEYWORDS)) {
    if (lowerMessage.includes(keyword)) {
      detectedIntent = intents[0]!;
      confidence = keyword.split(" ").length; // Favorece keywords más específicas
      break;
    }
  }

  // Extrae entidades
  const date = extractDate(message);
  const time = extractTime(message);
  const patientName = extractPatientName(message);

  // Intenta detectar período
  let period: "today" | "tomorrow" | "week" | "month" | undefined;
  if (lowerMessage.includes("hoy")) {
    period = "today";
  } else if (lowerMessage.includes("mañana")) {
    period = "tomorrow";
  } else if (lowerMessage.includes("semana")) {
    period = "week";
  } else if (lowerMessage.includes("mes")) {
    period = "month";
  }

  return {
    intent: detectedIntent,
    entities: {
      date,
      time,
      patientName,
      period,
    },
    raw: message,
  };
}
