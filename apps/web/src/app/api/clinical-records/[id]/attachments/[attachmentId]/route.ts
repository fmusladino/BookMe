import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinical-records/[id]/attachments/[attachmentId]
 * Descargar un archivo adjunto de historia clínica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: recordId, attachmentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar acceso: el registro debe pertenecer al profesional
    const { data: attachment } = await adminClient
      .from("clinical_attachments")
      .select("id, file_path, file_name, mime_type")
      .eq("id", attachmentId)
      .eq("record_id", recordId)
      .eq("professional_id", user.id)
      .single();

    if (!attachment) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    // Descargar desde Supabase Storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from("clinical-attachments")
      .download(attachment.file_path);

    if (downloadError || !fileData) {
      console.error("Error downloading file:", downloadError);
      return NextResponse.json({ error: "Error al descargar el archivo" }, { status: 500 });
    }

    // Registrar acceso en auditoría
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "0.0.0.0";
    const { error: auditErr } = await adminClient.from("clinical_record_audit").insert({
      record_id: recordId,
      accessed_by: user.id,
      action: "read",
      ip_address: ipAddress,
      details: { type: "attachment_download", file_name: attachment.file_name },
    });
    if (auditErr) console.error("Audit log error:", auditErr.message);

    // Devolver el archivo con headers apropiados
    const buffer = Buffer.from(await fileData.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.mime_type,
        "Content-Disposition": `inline; filename="${attachment.file_name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error GET attachment download:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
