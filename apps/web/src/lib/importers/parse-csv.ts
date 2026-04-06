/**
 * Parser para archivos CSV de turnos.
 * Soporta múltiples formatos de encabezados en inglés y español.
 */

import Papa from "papaparse";
import type { ParsedAppointment } from "./types";

/**
 * Nombres alternativos de columnas soportados (case-insensitive, sin acentos)
 */
const COLUMN_ALIASES = {
  patient: ["patient", "paciente", "nombre", "full_name", "fullname", "client", "cliente"],
  dni: ["dni", "document", "doc", "cedula", "cédula", "id_number"],
  email: ["email", "email_address", "correo"],
  phone: ["phone", "telefono", "teléfono", "celular", "mobile", "contact"],
  date: ["date", "fecha", "appointment_date", "fecha_turno"],
  time: ["time", "hora", "appointment_time", "hora_inicio"],
  startDateTime: ["start", "starts_at", "datetime", "fecha_hora", "start_time", "inicio"],
  endDateTime: ["end", "ends_at", "end_time", "fecha_fin", "fin"],
  service: ["service", "servicio", "type", "tipo", "consulta"],
  notes: ["notes", "notas", "description", "descripcion", "descripción", "comments"],
};

/**
 * Normaliza un nombre de columna para comparación
 * Remueve espacios, convierte a minúsculas y remueve acentos
 */
function normalizeColumnName(col: string): string {
  return col
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Encuentra el índice de una columna por sus alias alternativos
 */
function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeColumnName);
  const normalizedAliases = aliases.map(normalizeColumnName);

  for (let i = 0; i < normalized.length; i++) {
    if (normalizedAliases.includes(normalized[i])) {
      return i;
    }
  }

  return -1;
}

/**
 * Parsea un valor de date/time en formato ISO 8601
 */
function parseDateTime(dateStr: string, timeStr?: string): string {
  if (!dateStr) return "";

  // Intenta parsear diferentes formatos de fecha
  let date: Date | null = null;

  // Formato: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const dateFormats = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
  ];

  for (const format of dateFormats) {
    const match = dateStr.trim().match(format);
    if (match) {
      const [, p1, p2, p3] = match;
      let year: number, month: number, day: number;

      // Determina el formato basado en el patrón
      if (parseInt(p1) > 31) {
        // YYYY first
        [year, month, day] = [parseInt(p1), parseInt(p2), parseInt(p3)];
      } else {
        // DD/MM/YYYY
        [day, month, year] = [parseInt(p1), parseInt(p2), parseInt(p3)];
      }

      date = new Date(year, month - 1, day);
      break;
    }
  }

  // Si no se pudo parsear, intenta el parser default de JS
  if (!date) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    } else {
      return "";
    }
  }

  if (!date || isNaN(date.getTime())) {
    return "";
  }

  // Combina con hora si existe
  let finalDate = date;
  if (timeStr && timeStr.trim()) {
    const timeMatch = timeStr
      .trim()
      .match(/^(\d{1,2}):?(\d{2})(?::(\d{2}))?(\s*[ap]m)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[4];

      // Ajusta para AM/PM
      if (ampm) {
        if (/pm/i.test(ampm) && hours !== 12) hours += 12;
        if (/am/i.test(ampm) && hours === 12) hours = 0;
      }

      finalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
    }
  }

  return finalDate.toISOString();
}

/**
 * Parsea un archivo CSV y retorna turnos estructurados
 *
 * @param fileContent Contenido del archivo CSV como string
 * @returns Array de turnos parseados
 *
 * @example
 * const csv = "paciente,fecha,hora\nJuan,2026-01-15,10:00";
 * const appointments = parseCSV(csv);
 */
export function parseCSV(fileContent: string): ParsedAppointment[] {
  const results = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (results.errors && results.errors.length > 0) {
    console.error("CSV parse errors:", results.errors);
    throw new Error("Error al parsear CSV");
  }

  const data = results.data as Record<string, string>[];
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const headers = Object.keys(data[0] || {});

  // Encuentra índices de columnas
  const patientIdx = findColumnIndex(headers, COLUMN_ALIASES.patient);
  const dniIdx = findColumnIndex(headers, COLUMN_ALIASES.dni);
  const emailIdx = findColumnIndex(headers, COLUMN_ALIASES.email);
  const phoneIdx = findColumnIndex(headers, COLUMN_ALIASES.phone);
  const dateIdx = findColumnIndex(headers, COLUMN_ALIASES.date);
  const timeIdx = findColumnIndex(headers, COLUMN_ALIASES.time);
  const startDateTimeIdx = findColumnIndex(headers, COLUMN_ALIASES.startDateTime);
  const endDateTimeIdx = findColumnIndex(headers, COLUMN_ALIASES.endDateTime);
  const serviceIdx = findColumnIndex(headers, COLUMN_ALIASES.service);
  const notesIdx = findColumnIndex(headers, COLUMN_ALIASES.notes);

  const appointments: ParsedAppointment[] = [];

  for (const row of data) {
    const values = Object.values(row);

    // Extrae patient name (requerido)
    const patientName = patientIdx >= 0 ? values[patientIdx]?.trim() : "";
    if (!patientName) {
      continue; // Salta filas sin nombre de paciente
    }

    // Extrae otros campos
    const patientDni = dniIdx >= 0 ? values[dniIdx]?.trim() : undefined;
    const patientEmail = emailIdx >= 0 ? values[emailIdx]?.trim() : undefined;
    const patientPhone = phoneIdx >= 0 ? values[phoneIdx]?.trim() : undefined;
    const serviceName = serviceIdx >= 0 ? values[serviceIdx]?.trim() : undefined;
    const notes = notesIdx >= 0 ? values[notesIdx]?.trim() : undefined;

    // Parsea fechas/horas
    let startsAt = "";
    let endsAt: string | undefined;

    if (startDateTimeIdx >= 0) {
      // Si hay columna datetime combinada
      const dtValue = values[startDateTimeIdx]?.trim();
      startsAt = dtValue ? parseDateTime(dtValue) : "";
    } else if (dateIdx >= 0) {
      // Si hay columnas separadas de fecha y hora
      const dateValue = values[dateIdx]?.trim();
      const timeValue = timeIdx >= 0 ? values[timeIdx]?.trim() : "";
      startsAt = dateValue ? parseDateTime(dateValue, timeValue) : "";
    }

    if (!startsAt) {
      continue; // Salta si no tiene fecha válida
    }

    // Parsea fecha de fin si existe
    if (endDateTimeIdx >= 0) {
      const endValue = values[endDateTimeIdx]?.trim();
      endsAt = endValue ? parseDateTime(endValue) : undefined;
    }

    appointments.push({
      patientName,
      patientDni: patientDni || undefined,
      patientEmail: patientEmail || undefined,
      patientPhone: patientPhone || undefined,
      serviceName: serviceName || undefined,
      notes: notes || undefined,
      startsAt,
      endsAt,
      rawRow: row,
    });
  }

  return appointments;
}
