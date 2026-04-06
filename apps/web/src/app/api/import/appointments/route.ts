/**
 * API endpoint para importar turnos desde archivos externos
 * POST /api/import/appointments
 *
 * Soporta: CSV, XLSX, .ics (Google Calendar)
 * Requiere autenticación como profesional
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { parseCSV } from "@/lib/importers/parse-csv";
import { parseXLSX } from "@/lib/importers/parse-xlsx";
import { parseICS } from "@/lib/importers/parse-ics";
import type { ImportResult, ImportError, ParsedAppointment, ImportFileType } from "@/lib/importers/types";
import { validateAppointmentSlot } from "@/lib/schedule/validation";
import { randomUUID } from "crypto";

/**
 * Detecta el tipo de archivo a partir de su extensión
 */
function detectFileType(filename: string): ImportFileType | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "csv") return "csv";
  if (ext === "ics") return "ics";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  return null;
}

/**
 * Normaliza un DNI removiendo puntos, guiones y espacios
 */
function normalizeDNI(dni: string): string {
  return dni.replace(/[.\-\s]/g, "");
}


/**
 * Crea un nuevo paciente o retorna el ID del existente
 */
async function findOrCreatePatient(
  adminClient: ReturnType<typeof createAdminClient>,
  professionalId: string,
  appointment: ParsedAppointment
): Promise<string | null> {
  // Busca paciente existente
  let patientId: string | null = null;

  if (appointment.patientDni) {
    const normalized = normalizeDNI(appointment.patientDni);
    const { data } = await adminClient
      .from("patients")
      .select("id")
      .eq("professional_id", professionalId)
      .eq("dni", normalized)
      .limit(1)
      .single();

    if (data) {
      return data.id;
    }
  }

  // Busca por nombre aproximado
  const { data: byName } = await adminClient
    .from("patients")
    .select("id")
    .eq("professional_id", professionalId)
    .ilike("full_name", `%${appointment.patientName}%`)
    .limit(1)
    .single();

  if (byName) {
    return byName.id;
  }

  // Crea nuevo paciente
  const newPatientId = randomUUID();
  const normalized = appointment.patientDni ? normalizeDNI(appointment.patientDni) : randomUUID();

  const { data, error } = await adminClient
    .from("patients")
    .insert({
      id: newPatientId,
      professional_id: professionalId,
      dni: normalized,
      full_name: appointment.patientName,
      email: appointment.patientEmail || null,
      phone: appointment.patientPhone || null,
      is_particular: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating patient:", error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Busca un servicio por nombre para el profesional
 */
async function findService(
  adminClient: ReturnType<typeof createAdminClient>,
  professionalId: string,
  serviceName: string | undefined
): Promise<string | null> {
  if (!serviceName) {
    return null;
  }

  const { data } = await adminClient
    .from("services")
    .select("id")
    .eq("professional_id", professionalId)
    .ilike("name", `%${serviceName}%`)
    .limit(1)
    .single();

  return data?.id || null;
}

/**
 * POST /api/import/appointments
 * Importa turnos desde un archivo (CSV, XLSX, o .ics)
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica autenticación
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Lee el FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Se requiere un archivo" },
        { status: 400 }
      );
    }

    // Detecta el tipo de archivo
    const fileType = detectFileType(file.name);
    if (!fileType) {
      return NextResponse.json(
        { error: "Formato de archivo no soportado. Use CSV, XLSX o .ics" },
        { status: 400 }
      );
    }

    // Lee el contenido del archivo
    let appointments: ParsedAppointment[] = [];

    try {
      if (fileType === "csv") {
        const text = await file.text();
        appointments = parseCSV(text);
      } else if (fileType === "xlsx") {
        const buffer = await file.arrayBuffer();
        appointments = parseXLSX(buffer);
      } else if (fileType === "ics") {
        const text = await file.text();
        appointments = parseICS(text);
      }
    } catch (error) {
      console.error("Parse error:", error);
      return NextResponse.json(
        { error: `Error al parsear el archivo: ${error instanceof Error ? error.message : "desconocido"}` },
        { status: 400 }
      );
    }

    if (appointments.length === 0) {
      return NextResponse.json(
        { error: "El archivo no contiene turnos válidos" },
        { status: 400 }
      );
    }

    // Procesa los turnos
    const adminClient = createAdminClient();
    const result: ImportResult = {
      total: appointments.length,
      imported: 0,
      skipped: 0,
      errors: [],
      appointmentIds: [],
    };

    for (let i = 0; i < appointments.length; i++) {
      const appointment = appointments[i];
      const rowNumber = i + 1;

      try {
        // Busca o crea paciente
        const patientId = await findOrCreatePatient(adminClient, user.id, appointment);
        if (!patientId) {
          result.skipped++;
          result.errors.push({
            row: rowNumber,
            field: "patient",
            message: "No se pudo crear o encontrar el paciente",
          });
          continue;
        }

        // Busca servicio (opcional)
        let serviceId: string | null = null;
        if (appointment.serviceName) {
          serviceId = await findService(adminClient, user.id, appointment.serviceName);
        }

        // Si no tiene hora de fin, usa +30 minutos de la hora de inicio
        let endsAt = appointment.endsAt;
        if (!endsAt && appointment.startsAt) {
          const startDate = new Date(appointment.startsAt);
          const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
          endsAt = endDate.toISOString();
        }

        // Valida slot de horario
        const validationResult = await validateAppointmentSlot(
          adminClient,
          user.id,
          appointment.startsAt,
          endsAt || appointment.startsAt
        );

        if (!validationResult.valid) {
          result.skipped++;
          result.errors.push({
            row: rowNumber,
            message: validationResult.error || "Horario inválido según la configuración",
          });
          continue;
        }

        // Verifica solapamiento
        const { data: overlapping } = await adminClient
          .from("appointments")
          .select("id")
          .eq("professional_id", user.id)
          .in("status", ["pending", "confirmed"])
          .lt("starts_at", endsAt || appointment.startsAt)
          .gt("ends_at", appointment.startsAt)
          .limit(1);

        if (overlapping && overlapping.length > 0) {
          result.skipped++;
          result.errors.push({
            row: rowNumber,
            message: "Ya existe un turno en ese horario",
          });
          continue;
        }

        // Crea el turno
        const appointmentId = randomUUID();
        const { data: createdAppointment, error: insertError } = await adminClient
          .from("appointments")
          .insert({
            id: appointmentId,
            professional_id: user.id,
            patient_id: patientId,
            service_id: serviceId,
            starts_at: appointment.startsAt,
            ends_at: endsAt || appointment.startsAt,
            notes: appointment.notes || null,
            booked_by: user.id,
            status: "confirmed" as const,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Insert error:", insertError.message);
          result.skipped++;
          result.errors.push({
            row: rowNumber,
            message: `Error al insertar turno: ${insertError.message}`,
          });
          continue;
        }

        if (createdAppointment) {
          result.imported++;
          result.appointmentIds?.push(createdAppointment.id);
        }
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        result.skipped++;
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error POST /api/import/appointments:", error);
    return NextResponse.json(
      {
        error: "Error interno",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
