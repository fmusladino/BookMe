import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  encryptClinicalRecord,
  decryptClinicalRecord,
} from "@/lib/crypto/clinical-record";
import { z } from "zod";

// Esquema para crear enmienda
const amendmentSchema = z.object({
  content: z.string().min(1, "El contenido no puede estar vacío"),
  reason: z.string().min(1, "El motivo de la enmienda es obligatorio").max(500),
});

// Esquema para archivar/desarchivar
const archiveSchema = z.object({
  action: z.enum(["archive", "unarchive"]),
});

// GET /api/clinical-records/[id] — Obtener una historia clínica específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Obtener la historia clínica encriptada (incluir campos de inmutabilidad)
    const { data: record, error: fetchError } = await supabase
      .from("clinical_records")
      .select("id, professional_id, patient_id, appointment_id, content_encrypted, iv, is_amendment, amends_record_id, is_archived, created_at, updated_at")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: "Historia clínica no encontrada" },
        { status: 404 }
      );
    }

    // Desencriptar contenido
    let content: string;
    try {
      content = await decryptClinicalRecord(
        record.content_encrypted,
        record.iv
      );
    } catch (decryptError) {
      console.error(`Error desencriptando registro ${id}:`, decryptError);
      return NextResponse.json(
        { error: "No se pudo desencriptar el contenido" },
        { status: 500 }
      );
    }

    // Registrar acceso en auditoría
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
        action: "read",
        ip_address: ipAddress,
      })
      .catch((err) => {
        console.error("Error registrando auditoría READ:", err);
      });

    // Obtener enmiendas de este registro (si las hay)
    const { data: amendments } = await supabase
      .from("clinical_records")
      .select("id, content_encrypted, iv, created_at")
      .eq("amends_record_id", id)
      .order("created_at", { ascending: true });

    const decryptedAmendments = await Promise.all(
      (amendments || []).map(async (a) => {
        try {
          const c = await decryptClinicalRecord(a.content_encrypted, a.iv);
          return { id: a.id, content: c, created_at: a.created_at };
        } catch {
          return { id: a.id, content: "[Error al desencriptar]", created_at: a.created_at };
        }
      })
    );

    return NextResponse.json({
      record: {
        id: record.id,
        professional_id: record.professional_id,
        patient_id: record.patient_id,
        appointment_id: record.appointment_id,
        content,
        is_amendment: record.is_amendment,
        amends_record_id: record.amends_record_id,
        is_archived: record.is_archived,
        created_at: record.created_at,
        updated_at: record.updated_at,
        amendments: decryptedAmendments,
      },
    });
  } catch (error) {
    console.error("Error GET /api/clinical-records/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/clinical-records/[id] — Crear enmienda o archivar/desarchivar
// Ya NO sobrescribe el contenido original (inmutabilidad Ley 26.529)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json() as unknown;

    // Verificar que el registro original existe y pertenece al profesional
    const { data: existingRecord, error: fetchError } = await supabase
      .from("clinical_records")
      .select("id, professional_id, patient_id, appointment_id")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (fetchError || !existingRecord) {
      return NextResponse.json(
        { error: "Historia clínica no encontrada" },
        { status: 404 }
      );
    }

    const adminClient = createAdminClient();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    // Opción A: Archivar/Desarchivar
    const archiveParsed = archiveSchema.safeParse(body);
    if (archiveParsed.success) {
      const isArchive = archiveParsed.data.action === "archive";

      const { error: updateError } = await supabase
        .from("clinical_records")
        .update({ is_archived: isArchive })
        .eq("id", id)
        .eq("professional_id", user.id);

      if (updateError) {
        console.error("Error archivando registro:", updateError.message);
        return NextResponse.json(
          { error: "Error al archivar el registro" },
          { status: 500 }
        );
      }

      // Auditoría
      await adminClient
        .from("clinical_record_audit")
        .insert({
          record_id: id,
          accessed_by: user.id,
          action: isArchive ? "delete" : "update",
          ip_address: ipAddress,
          details: { type: isArchive ? "archive" : "unarchive" },
        })
        .catch((err) => {
          console.error("Error registrando auditoría ARCHIVE:", err);
        });

      return NextResponse.json({
        message: isArchive
          ? "Registro archivado correctamente"
          : "Registro desarchivado correctamente",
      });
    }

    // Opción B: Crear enmienda (nueva entrada que referencia la original)
    const amendParsed = amendmentSchema.safeParse(body);
    if (!amendParsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos. Enviá { content, reason } para enmienda o { action: 'archive'|'unarchive' } para archivar.", details: amendParsed.error.flatten() },
        { status: 400 }
      );
    }

    const { content, reason } = amendParsed.data;

    // Encriptar el contenido de la enmienda
    let encryptedData;
    try {
      encryptedData = await encryptClinicalRecord(content);
    } catch (encryptError) {
      console.error("Error encriptando enmienda:", encryptError);
      return NextResponse.json(
        { error: "Error al encriptar los datos" },
        { status: 500 }
      );
    }

    // Crear nueva entrada como enmienda
    const { data: amendment, error: insertError } = await supabase
      .from("clinical_records")
      .insert({
        professional_id: user.id,
        patient_id: existingRecord.patient_id,
        appointment_id: existingRecord.appointment_id || null,
        content_encrypted: encryptedData.contentEncrypted,
        iv: encryptedData.iv,
        is_amendment: true,
        amends_record_id: id,
      })
      .select()
      .single();

    if (insertError || !amendment) {
      console.error("Error creando enmienda:", insertError?.message);
      return NextResponse.json(
        { error: "Error al crear la enmienda" },
        { status: 500 }
      );
    }

    // Auditoría para la enmienda
    await adminClient
      .from("clinical_record_audit")
      .insert({
        record_id: amendment.id,
        accessed_by: user.id,
        action: "amendment",
        ip_address: ipAddress,
        details: {
          amends_record_id: id,
          reason,
        },
      })
      .catch((err) => {
        console.error("Error registrando auditoría AMENDMENT:", err);
      });

    // Desencriptar para devolver en respuesta
    const decryptedContent = await decryptClinicalRecord(
      amendment.content_encrypted,
      amendment.iv
    );

    return NextResponse.json(
      {
        record: {
          id: amendment.id,
          professional_id: amendment.professional_id,
          patient_id: amendment.patient_id,
          appointment_id: amendment.appointment_id,
          content: decryptedContent,
          is_amendment: true,
          amends_record_id: id,
          reason,
          created_at: amendment.created_at,
          updated_at: amendment.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error PATCH /api/clinical-records/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — PROHIBIDO (Ley 26.529)
// Las entradas de historia clínica no pueden eliminarse.
// El profesional puede archivarlas via PATCH con { action: "archive" }
export async function DELETE() {
  return NextResponse.json(
    {
      error: "Las entradas de historia clínica no pueden eliminarse (Ley 26.529). " +
        "Puede archivar la entrada usando PATCH con { action: 'archive' }.",
    },
    { status: 403 }
  );
}
