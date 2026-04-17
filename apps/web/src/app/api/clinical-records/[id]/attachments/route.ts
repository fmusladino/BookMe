import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
// Mapa extensión → MIME para doble validación (evita archivos .exe renombrados con MIME falso)
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".pdf": ["application/pdf"],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Valida que la extensión del archivo coincida con su MIME type declarado */
function validateFileExtension(fileName: string, mimeType: string): boolean {
  const ext = ("." + (fileName.split(".").pop() || "")).toLowerCase();
  const allowedMimes = ALLOWED_EXTENSIONS[ext];
  if (!allowedMimes) return false; // extensión no permitida
  return allowedMimes.includes(mimeType);
}

/**
 * GET /api/clinical-records/[id]/attachments
 * Listar archivos adjuntos de un registro clínico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar que el registro pertenece al profesional
    const { data: record } = await adminClient
      .from("clinical_records")
      .select("id, professional_id")
      .eq("id", recordId)
      .eq("professional_id", user.id)
      .single();

    if (!record) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    // Obtener archivos adjuntos
    const { data: attachments, error } = await adminClient
      .from("clinical_attachments")
      .select("id, file_name, file_size, mime_type, created_at")
      .eq("record_id", recordId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching attachments:", error);
      return NextResponse.json({ error: "Error al obtener archivos" }, { status: 500 });
    }

    return NextResponse.json({ attachments: attachments ?? [] });
  } catch (error) {
    console.error("Error GET attachments:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/clinical-records/[id]/attachments
 * Subir archivo adjunto a un registro clínico
 * Body: multipart/form-data con campo "file"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar que el registro pertenece al profesional
    const { data: record } = await adminClient
      .from("clinical_records")
      .select("id, professional_id, patient_id")
      .eq("id", recordId)
      .eq("professional_id", user.id)
      .single();

    if (!record) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    // Parsear el formulario multipart
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validar tipo de archivo (MIME)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido. Tipos válidos: JPG, PNG, WebP, PDF` },
        { status: 400 }
      );
    }

    // Validar extensión vs MIME (defense in depth contra MIME spoofing)
    if (!validateFileExtension(file.name, file.type)) {
      return NextResponse.json(
        { error: "La extensión del archivo no coincide con su tipo. Verificá que el archivo sea válido." },
        { status: 400 }
      );
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo de 10 MB" },
        { status: 400 }
      );
    }

    // Generar ruta de almacenamiento: {professional_id}/{patient_id}/{record_id}/{timestamp}_{filename}
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${record.patient_id}/${recordId}/${timestamp}_${safeFileName}`;

    // Subir a Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminClient.storage
      .from("clinical-attachments")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Error al subir el archivo", details: uploadError.message },
        { status: 500 }
      );
    }

    // Registrar en la base de datos
    const { data: attachment, error: insertError } = await adminClient
      .from("clinical_attachments")
      .insert({
        record_id: recordId,
        professional_id: user.id,
        patient_id: record.patient_id,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
      })
      .select("id, file_name, file_size, mime_type, created_at")
      .single();

    if (insertError || !attachment) {
      console.error("Error inserting attachment record:", insertError);
      return NextResponse.json(
        { error: "Error al registrar el archivo" },
        { status: 500 }
      );
    }

    // Registrar en auditoría
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "0.0.0.0";
    const { error: auditErr } = await adminClient.from("clinical_record_audit").insert({
      record_id: recordId,
      accessed_by: user.id,
      action: "update",
      ip_address: ipAddress,
      details: { type: "attachment_upload", file_name: file.name, mime_type: file.type },
    });
    if (auditErr) console.error("Audit log error:", auditErr.message);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("Error POST attachment:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
