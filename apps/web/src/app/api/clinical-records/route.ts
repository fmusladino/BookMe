import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  encryptClinicalRecord,
  decryptClinicalRecord,
} from "@/lib/crypto/clinical-record";
import { z } from "zod";

// Esquema de validación para crear historia clínica
const createClinicalRecordSchema = z.object({
  patient_id: z.string().uuid("ID de paciente inválido"),
  appointment_id: z.string().uuid("ID de turno inválido").optional(),
  content: z.string().min(1, "El contenido no puede estar vacío"),
});

// GET /api/clinical-records — Obtener historias clínicas de un paciente
// Query params: patient_id (requerido)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");

    if (!patientId) {
      return NextResponse.json(
        { error: "patient_id es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el profesional tiene acceso a este paciente
    // (es decir, ha tenido turnos con este paciente)
    const { data: patientAccess, error: accessError } = await supabase
      .from("appointments")
      .select("id")
      .eq("professional_id", user.id)
      .eq("patient_id", patientId)
      .limit(1);

    if (accessError || !patientAccess || patientAccess.length === 0) {
      return NextResponse.json(
        { error: "No tienes acceso a los registros de este paciente" },
        { status: 403 }
      );
    }

    // Parámetro opcional para incluir archivados
    const includeArchived = searchParams.get("include_archived") === "true";

    // Obtener las historias clínicas encriptadas
    let query = supabase
      .from("clinical_records")
      .select("id, professional_id, patient_id, appointment_id, content_encrypted, iv, is_amendment, amends_record_id, is_archived, created_at, updated_at")
      .eq("professional_id", user.id)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    const { data: encryptedRecords, error: fetchError } = await query;

    if (fetchError) {
      console.error("Supabase error clinical_records:", fetchError.message);
      return NextResponse.json(
        { error: "Error al obtener historias clínicas" },
        { status: 500 }
      );
    }

    // Desencriptar contenido de cada historia
    const records = await Promise.all(
      (encryptedRecords || []).map(async (record) => {
        try {
          const content = await decryptClinicalRecord(
            record.content_encrypted,
            record.iv
          );
          return {
            id: record.id,
            professional_id: record.professional_id,
            patient_id: record.patient_id,
            appointment_id: record.appointment_id,
            content,
            is_amendment: record.is_amendment ?? false,
            amends_record_id: record.amends_record_id ?? null,
            is_archived: record.is_archived ?? false,
            created_at: record.created_at,
            updated_at: record.updated_at,
          };
        } catch (decryptError) {
          console.error(`Error desencriptando registro ${record.id}:`, decryptError);
          return {
            id: record.id,
            professional_id: record.professional_id,
            patient_id: record.patient_id,
            appointment_id: record.appointment_id,
            content: null,
            is_amendment: record.is_amendment ?? false,
            amends_record_id: record.amends_record_id ?? null,
            is_archived: record.is_archived ?? false,
            created_at: record.created_at,
            updated_at: record.updated_at,
            error: "No se pudo desencriptar el contenido",
          };
        }
      })
    );

    // Registrar acceso de auditoría para cada registro
    const adminClient = createAdminClient();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    for (const record of encryptedRecords || []) {
      await adminClient
        .from("clinical_record_audit")
        .insert({
          record_id: record.id,
          accessed_by: user.id,
          action: "read",
          ip_address: ipAddress,
        })
        .catch((err) => {
          console.error(`Error registrando auditoría para ${record.id}:`, err);
        });
    }

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Error GET /api/clinical-records:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/clinical-records — Crear nueva historia clínica
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json() as unknown;
    const parsed = createClinicalRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { patient_id, appointment_id, content } = parsed.data;

    // Verificar que el profesional tiene acceso a este paciente
    const { data: patientAccess, error: accessError } = await supabase
      .from("appointments")
      .select("id")
      .eq("professional_id", user.id)
      .eq("patient_id", patient_id)
      .limit(1);

    if (accessError || !patientAccess || patientAccess.length === 0) {
      return NextResponse.json(
        { error: "No tienes acceso a los registros de este paciente" },
        { status: 403 }
      );
    }

    // Si se proporciona appointment_id, verificar que pertenece al profesional y paciente
    if (appointment_id) {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", appointment_id)
        .eq("professional_id", user.id)
        .eq("patient_id", patient_id)
        .single();

      if (appointmentError || !appointment) {
        return NextResponse.json(
          { error: "El turno no existe o no tienes acceso" },
          { status: 404 }
        );
      }
    }

    // Encriptar el contenido
    let encryptedData;
    try {
      encryptedData = await encryptClinicalRecord(content);
    } catch (encryptError) {
      console.error("Error encriptando historia clínica:", encryptError);
      return NextResponse.json(
        { error: "Error al encriptar los datos" },
        { status: 500 }
      );
    }

    // Guardar en la base de datos
    const { data: record, error: insertError } = await supabase
      .from("clinical_records")
      .insert({
        professional_id: user.id,
        patient_id,
        appointment_id: appointment_id || null,
        content_encrypted: encryptedData.contentEncrypted,
        iv: encryptedData.iv,
      })
      .select()
      .single();

    if (insertError || !record) {
      console.error("Supabase error creating clinical_record:", insertError?.message);
      return NextResponse.json(
        { error: "Error al crear la historia clínica" },
        { status: 500 }
      );
    }

    // Registrar en auditoría
    const adminClient = createAdminClient();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    await adminClient
      .from("clinical_record_audit")
      .insert({
        record_id: record.id,
        accessed_by: user.id,
        action: "create",
        ip_address: ipAddress,
      })
      .catch((err) => {
        console.error("Error registrando auditoría CREATE:", err);
      });

    // Desencriptar para devolver en respuesta
    const decryptedContent = await decryptClinicalRecord(
      record.content_encrypted,
      record.iv
    );

    return NextResponse.json(
      {
        record: {
          id: record.id,
          professional_id: record.professional_id,
          patient_id: record.patient_id,
          appointment_id: record.appointment_id,
          content: decryptedContent,
          created_at: record.created_at,
          updated_at: record.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/clinical-records:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
