/**
 * Parser para archivos .ics (iCalendar) de Google Calendar.
 * Parsea manualmente bloques VEVENT sin dependencias externas.
 */

import type { ParsedAppointment } from "./types";

/**
 * Interfaz para un evento parseado del ICS
 */
interface ICSEvent {
  summary?: string;
  description?: string;
  dtstart?: string;
  dtend?: string;
  uid?: string;
}

/**
 * Convierte una fecha ICS (RFC 5545) a ISO 8601
 * Soporta formatos:
 * - 20260401T140000Z (UTC)
 * - 20260401T140000 (sin zona horaria)
 * - 20260401 (solo fecha)
 */
function parseICSDateTime(icsDate: string): string {
  if (!icsDate) return "";

  icsDate = icsDate.trim().toUpperCase();

  // Si solo tiene fecha (8 caracteres: YYYYMMDD)
  if (icsDate.length === 8 && /^\d{8}$/.test(icsDate)) {
    const year = parseInt(icsDate.substring(0, 4));
    const month = parseInt(icsDate.substring(4, 6));
    const day = parseInt(icsDate.substring(6, 8));

    const date = new Date(year, month - 1, day, 0, 0, 0);
    return date.toISOString();
  }

  // Formato con hora: YYYYMMDDTHHMMSSZ o YYYYMMDDTHHMMSS
  const dateTimeRegex = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;
  const match = icsDate.match(dateTimeRegex);

  if (match) {
    const [, year, month, day, hours, minutes, seconds, isUTC] = match;

    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );

    // Si es UTC (termina con Z), ya está en formato ISO
    if (isUTC) {
      return date.toISOString();
    }

    // Si no es UTC, intenta convertir a ISO considerando como local
    return date.toISOString();
  }

  return "";
}

/**
 * Extrae el valor de una propiedad ICS
 * Maneja encoding y valores multi-línea
 */
function extractICSValue(line: string): string {
  // Formato: PROPERTY:value
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return "";

  let value = line.substring(colonIndex + 1);

  // Decodifica caracteres escapados
  value = value
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");

  return value.trim();
}

/**
 * Parsea un bloque VEVENT del archivo ICS
 */
function parseVEVENT(eventBlock: string): ICSEvent {
  const event: ICSEvent = {};
  const lines = eventBlock.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Propiedades que nos interesan
    if (trimmed.startsWith("SUMMARY")) {
      event.summary = extractICSValue(trimmed);
    } else if (trimmed.startsWith("DESCRIPTION")) {
      event.description = extractICSValue(trimmed);
    } else if (trimmed.startsWith("DTSTART")) {
      // DTSTART puede tener parámetros como DTSTART;TZID=...
      const value = extractICSValue(trimmed);
      event.dtstart = value;
    } else if (trimmed.startsWith("DTEND")) {
      const value = extractICSValue(trimmed);
      event.dtend = value;
    } else if (trimmed.startsWith("UID")) {
      event.uid = extractICSValue(trimmed);
    }
  }

  return event;
}

/**
 * Parsea un archivo .ics (Google Calendar) y retorna turnos estructurados
 *
 * @param fileContent Contenido del archivo .ics como string
 * @returns Array de turnos parseados
 *
 * @example
 * const icsContent = "BEGIN:VCALENDAR\n...END:VCALENDAR";
 * const appointments = parseICS(icsContent);
 */
export function parseICS(fileContent: string): ParsedAppointment[] {
  // Remueve saltos de línea de continuación (líneas que empiezan con espacio)
  const normalized = fileContent
    .split("\n")
    .reduce((acc, line) => {
      if (line.startsWith(" ") || line.startsWith("\t")) {
        // Línea de continuación
        if (acc.length > 0) {
          acc[acc.length - 1] += line.substring(1);
        }
      } else {
        acc.push(line);
      }
      return acc;
    }, [] as string[])
    .join("\n");

  // Divide por eventos
  const eventBlocks = normalized.split(/BEGIN:VEVENT/i);
  const appointments: ParsedAppointment[] = [];

  for (let i = 1; i < eventBlocks.length; i++) {
    const blockContent = eventBlocks[i];
    const endIndex = blockContent.indexOf("END:VEVENT");

    if (endIndex === -1) continue;

    const eventContent = blockContent.substring(0, endIndex);
    const event = parseVEVENT(eventContent);

    if (!event.dtstart) {
      continue; // Salta eventos sin fecha de inicio
    }

    const startsAt = parseICSDateTime(event.dtstart);
    if (!startsAt) {
      continue; // Salta si no se puede parsear la fecha
    }

    let endsAt: string | undefined;
    if (event.dtend) {
      const parsed = parseICSDateTime(event.dtend);
      if (parsed) {
        endsAt = parsed;
      }
    }

    // Usa SUMMARY como nombre del paciente (o del servicio)
    // En Google Calendar generalmente está la descripción del evento en SUMMARY
    const patientName = event.summary || "Sin nombre";

    appointments.push({
      patientName,
      serviceName: event.summary,
      notes: event.description,
      startsAt,
      endsAt,
      rawRow: event,
    });
  }

  return appointments;
}
