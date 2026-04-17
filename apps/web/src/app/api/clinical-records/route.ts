import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Parsea el contenido desencriptado de un registro clínico.
 * Los registros nuevos se guardan como JSON { content, diagnosis, notes }.
 * Los registros viejos son texto plano (backward compatible).
 */
function parseRecordContent(decrypted: string): { content: string; diagnosis: string | null; notes: string | null } {
  try {
    const parsed = JSON.parse(decrypted) as { content?: string; diagnosis?: string; notes?: string };
    if (parsed && typeof parsed.content === "string") {
      return {
        content: parsed.content,
        diagnosis: parsed.diagnosis || null,
        notes: parsed.notes || null,
      };
    }
  } catch {
    // No es JSON — registro viejo con texto plano
  }
  return { content: decrypted, diagnosis: null, notes: null };
}

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

    // Usar adminClient para todas las queries de datos (RLS causa 500 en algunos casos)
    // La seguridad se garantiza filtrando siempre por professional_id = user.id
    const adminClient = createAdminClient();

    // Verificar que el profesional tiene acceso a este paciente
    const { data: patientAccess, error: accessError } = await adminClient
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
    // Intentar con columnas de inmutabilidad (migración 00009). Si falla, query básica.
    let encryptedRecords: Record<string, unknown>[] | null = null;
    let fetchError: { message: string } | null = null;

    // Intentar query completa primero
    const result1 = await adminClient
      .from("clinical_records")
      .select("id, professional_id, patient_id, appointment_id, content_encrypted, iv, is_amendment, amends_record_id, is_archived, created_at, updated_at")
      .eq("professional_id", user.id)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (result1.error) {
      // Posible: columnas de migración 00009 no existen. Intentar query básica
      console.log("[CLINICAL-RECORDS GET] Full query failed:", result1.error.message, "— trying basic query");
      const result2 = await adminClient
        .from("clinical_records")
        .select("id, professional_id, patient_id, appointment_id, content_encrypted, iv, created_at, updated_at")
        .eq("professional_id", user.id)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      encryptedRecords = result2.data as Record<string, unknown>[] | null;
      fetchError = result2.error;
    } else {
      // Filtrar archivados si corresponde
      if (!includeArchived && result1.data) {
        encryptedRecords = (result1.data as Record<string, unknown>[]).filter(
          (r) => r.is_archived !== true
        );
      } else {
        encryptedRecords = result1.data as Record<string, unknown>[] | null;
      }
      fetchError = null;
    }

    console.log("[CLINICAL-RECORDS GET] Records found:", encryptedRecords?.length ?? "NULL", fetchError?.message ?? "OK");

    if (fetchError) {
      console.error("Supabase error clinical_records:", fetchError.message);
      return NextResponse.json(
        { error: "Error al obtener historias clínicas" },
        { status: 500 }
      );
    }

    // Desencriptar contenido de cada historia y parsear campos estructurados
    const records = await Promise.all(
      (encryptedRecords || []).map(async (record) => {
        try {
          const decrypted = await decryptClinicalRecord(
            record.content_encrypted as string,
            record.iv as string
          );
          const { content, diagnosis, notes } = parseRecordContent(decrypted);
          return {
            id: record.id,
            professional_id: record.professional_id,
            patient_id: record.patient_id,
            appointment_id: record.appointment_id,
            content,
            diagnosis,
            notes,
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
            diagnosis: null,
            notes: null,
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
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    for (const record of encryptedRecords || []) {
      try {
        await adminClient
          .from("clinical_record_audit")
          .insert({
            record_id: record.id,
            accessed_by: user.id,
            action: "read",
            ip_address: ipAddress,
          });
      } catch (err: unknown) {
        console.error(`Error registrando auditoría para ${record.id}:`, err);
      }
    }

    return NextResponse.json({ records });
  } catch (error) {
    console.error("[CLINICAL-RECORDS GET] UNCAUGHT ERROR:", error instanceof Error ? error.message : error, error instanceof Error ? error.stack : "");
    return NextResponse.json({ error: "Error interno", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
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

    const { patient_id, appointment_id, content, diagnosis, notes } = parsed.data;

    // Construir el contenido estructurado como JSON para encriptar
    const structuredContent = JSON.stringify({
      content,
      diagnosis: diagnosis || null,
      notes: notes || null,
    });

    // Usar adminClient para queries (RLS causa 500 en algunos flujos)
    // Seguridad: siempre filtramos por professional_id = user.id
    const adminClient = createAdminClient();

    // Verificar que el profesional tiene acceso a este paciente
    const { data: patientAccess, error: accessError } = await adminClient
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
      const { data: appointment, error: appointmentError } = await adminClient
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
      console.log("[CLINICAL-RECORDS POST] Encrypting content, length:", structuredContent.length);
      encryptedData = await encryptClinicalRecord(structuredContent);
      console.log("[CLINICAL-RECORDS POST] Encryption OK, encrypted length:", encryptedData.contentEncrypted.length);
    } catch (encryptError) {
      console.error("Error encriptando historia clínica:", encryptError);
      return NextResponse.json(
        { error: "Error al encriptar los datos", details: encryptError instanceof Error ? encryptError.message : String(encryptError) },
        { status: 500 }
      );
    }

    // Guardar en la base de datos
    const { data: record, error: insertError } = await adminClient
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
      console.error("Supabase error creating clinical_record:", insertError?.message, insertError);
      return NextResponse.json(
        { error: "Error al crear la historia clínica", details: insertError?.message || "record is null", code: insertError?.code },
        { status: 500 }
      );
    }

    // Registrar en auditoría
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    try {
      await adminClient
        .from("clinical_record_audit")
        .insert({
          record_id: record.id,
          accessed_by: user.id,
          action: "create",
          ip_address: ipAddress,
        });
    } catch (err: unknown) {
      console.error("Error registrando auditoría CREATE:", err);
    }

    // === AUTO-BILLING: Generar ítem de facturación si el paciente tiene prepaga ===
    try {
      const { data: patient } = await adminClient
        .from("patients")
        .select("id, insurance_id, insurance_number, is_particular")
        .eq("id", patient_id)
        .single();

      if (patient && patient.insurance_id && !patient.is_particular) {
        // Buscar si ya existe billing_item para este turno (evitar duplicados)
        const appointmentForBilling = appointment_id || null;
        let alreadyBilled = false;

        if (appointmentForBilling) {
          const { data: existingBilling } = await adminClient
            .from("billing_items")
            .select("id")
            .eq("appointment_id", appointmentForBilling)
            .limit(1);
          alreadyBilled = (existingBilling && existingBilling.length > 0) || false;
        }

        if (!alreadyBilled) {
          // Buscar prestación activa para esta prepaga
          const { data: prestacion } = await adminClient
            .from("prestaciones")
            .select("id, code, description, amount")
            .eq("professional_id", user.id)
            .eq("insurance_id", patient.insurance_id)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (prestacion) {
            const now = new Date();
            const { error: billingErr } = await adminClient
              .from("billing_items")
              .insert({
                professional_id: user.id,
                patient_id,
                appointment_id: appointmentForBilling,
                insurance_id: patient.insurance_id,
                practice_code: prestacion.code || "CONS",
                practice_name: prestacion.description || "Consulta",
                amount: prestacion.amount || 0,
                status: "pending",
                period_month: now.getMonth() + 1,
                period_year: now.getFullYear(),
              });

            if (billingErr) {
              console.error("[AUTO-BILLING] Error creando billing_item:", billingErr.message);
            } else {
              if (process.env.NODE_ENV !== "production") console.log("[AUTO-BILLING] Billing item creado");
            }
          } else {
            if (process.env.NODE_ENV !== "production") console.log("[AUTO-BILLING] No se encontró prestación activa");
          }
        }
      }
    } catch (billingError) {
      // No bloquear la creación de HC si falla el billing
      console.error("[AUTO-BILLING] Error en auto-billing:", billingError);
    }

    // Desencriptar para devolver en respuesta
    const decrypted = await decryptClinicalRecord(
      record.content_encrypted as string,
      record.iv as string
    );
    const parsedFields = parseRecordContent(decrypted);

    return NextResponse.json(
      {
        record: {
          id: record.id,
          professional_id: record.professional_id,
          patient_id: record.patient_id,
          appointment_id: record.appointment_id,
          content: parsedFields.content,
          diagnosis: parsedFields.diagnosis,
          notes: parsedFields.notes,
          created_at: record.created_at,
          updated_at: record.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/clinical-records:", error);
    return NextResponse.json({
      error: "Error al crear el registro clínico",
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : undefined,
    }, { status: 500 });
  }
}
