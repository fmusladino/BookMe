/**
 * Parser para archivos XLSX (Excel) de turnos.
 * Usa SheetJS para leer la primera hoja del libro.
 */

import * as XLSX from "xlsx";
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
function parseDateTime(dateVal: unknown, timeVal?: unknown): string {
  let dateStr = "";
  let timeStr = "";

  // Convierte el valor a string si es necesario
  if (typeof dateVal === "number") {
    // Excel date serial number
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
    return date.toISOString();
  } else if (dateVal instanceof Date) {
    dateStr = dateVal.toISOString();
  } else if (typeof dateVal === "string") {
    dateStr = dateVal;
  } else {
    return "";
  }

  if (typeof timeVal === "string") {
    timeStr = timeVal;
  } else if (typeof timeVal === "number") {
    const hours = Math.floor(timeVal * 24);
    const minutes = Math.floor((timeVal * 24 * 60) % 60);
    timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Si dateStr es ya ISO completo, retorna
  if (dateStr.includes("T")) {
    return dateStr;
  }

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
 * Parsea un archivo XLSX y retorna turnos estructurados
 * Lee la primera hoja del libro de Excel
 *
 * @param buffer ArrayBuffer del archivo XLSX
 * @returns Array de turnos parseados
 *
 * @example
 * const fileInput = document.querySelector('input[type="file"]');
 * const buffer = await fileInput.files[0].arrayBuffer();
 * const appointments = parseXLSX(buffer);
 */
export function parseXLSX(buffer: ArrayBuffer): ParsedAppointment[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return [];
  }

  // Convierte a array de objetos con headers
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

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
    const patientName =
      patientIdx >= 0 ? String(values[patientIdx] || "").trim() : "";
    if (!patientName) {
      continue; // Salta filas sin nombre de paciente
    }

    // Extrae otros campos
    const patientDni =
      dniIdx >= 0 ? String(values[dniIdx] || "").trim() : undefined;
    const patientEmail =
      emailIdx >= 0 ? String(values[emailIdx] || "").trim() : undefined;
    const patientPhone =
      phoneIdx >= 0 ? String(values[phoneIdx] || "").trim() : undefined;
    const serviceName =
      serviceIdx >= 0 ? String(values[serviceIdx] || "").trim() : undefined;
    const notes = notesIdx >= 0 ? String(values[notesIdx] || "").trim() : undefined;

    // Parsea fechas/horas
    let startsAt = "";
    let endsAt: string | undefined;

    if (startDateTimeIdx >= 0) {
      // Si hay columna datetime combinada
      startsAt = parseDateTime(values[startDateTimeIdx]);
    } else if (dateIdx >= 0) {
      // Si hay columnas separadas de fecha y hora
      const timeValue = timeIdx >= 0 ? values[timeIdx] : undefined;
      startsAt = parseDateTime(values[dateIdx], timeValue);
    }

    if (!startsAt) {
      continue; // Salta si no tiene fecha válida
    }

    // Parsea fecha de fin si existe
    if (endDateTimeIdx >= 0) {
      endsAt = parseDateTime(values[endDateTimeIdx]);
    }

    appointments.push({
      patientName,
      patientDni: patientDni && patientDni !== "" ? patientDni : undefined,
      patientEmail: patientEmail && patientEmail !== "" ? patientEmail : undefined,
      patientPhone: patientPhone && patientPhone !== "" ? patientPhone : undefined,
      serviceName: serviceName && serviceName !== "" ? serviceName : undefined,
      notes: notes && notes !== "" ? notes : undefined,
      startsAt,
      endsAt,
      rawRow: row,
    });
  }

  return appointments;
}
