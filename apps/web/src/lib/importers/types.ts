/**
 * Tipos para el importador de turnos desde archivos externos.
 * Soporta CSV, XLSX y .ics (Google Calendar)
 */

/**
 * Estructura de un turno parseado desde un archivo
 */
export interface ParsedAppointment {
  /** Nombre del paciente / cliente */
  patientName: string;
  /** DNI del paciente (opcional) */
  patientDni?: string;
  /** Email del paciente (opcional) */
  patientEmail?: string;
  /** Teléfono del paciente (opcional) */
  patientPhone?: string;
  /** Fecha y hora de inicio en formato ISO 8601 */
  startsAt: string;
  /** Fecha y hora de fin en formato ISO 8601 (opcional) */
  endsAt?: string;
  /** Nombre del servicio / tipo de consulta (opcional) */
  serviceName?: string;
  /** Notas o descrición adicional (opcional) */
  notes?: string;
  /** Fila original del archivo (para debugging) */
  rawRow?: Record<string, unknown>;
}

/**
 * Resultado de la importación de turnos
 */
export interface ImportResult {
  /** Total de registros procesados */
  total: number;
  /** Total de turnos importados exitosamente */
  imported: number;
  /** Total de registros omitidos (validación fallida) */
  skipped: number;
  /** Errores durante la importación */
  errors: ImportError[];
  /** IDs de los turnos creados */
  appointmentIds?: string[];
}

/**
 * Error durante la importación de un registro
 */
export interface ImportError {
  /** Número de fila en el archivo */
  row: number;
  /** Campo que causó el error (opcional) */
  field?: string;
  /** Mensaje descriptivo del error */
  message: string;
}

/**
 * Tipos de archivos soportados
 */
export type ImportFileType = "csv" | "xlsx" | "ics";

/**
 * Interfaz para los parsers de archivos
 */
export interface FileParser {
  parse: (content: string | ArrayBuffer) => ParsedAppointment[] | Promise<ParsedAppointment[]>;
}
