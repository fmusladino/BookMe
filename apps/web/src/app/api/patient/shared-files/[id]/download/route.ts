import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/patient/shared-files/[id]/download
 *
 * Devuelve una URL firmada (válida 60 segundos) para descargar el archivo.
 * Accesible tanto por el paciente que lo subió como por el profesional destinatario.
 * Si lo abre el profesional, registra viewed_at.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminClient();

    const { data: file, error } = await adminClient
      .from("patient_shared_files")
      .select(
        "id, file_path, file_name, mime_type, patient_profile_id, professional_id, viewed_at"
      )
      .eq("id", id)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const isOwnerPatient = file.patient_profile_id === user.id;
    const isRecipientPro = file.professional_id === user.id;

    if (!isOwnerPatient && !isRecipientPro) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { data: signed, error: signErr } = await adminClient.storage
      .from("patient-shared-files")
      .createSignedUrl(file.file_path, 60, { download: file.file_name });

    if (signErr || !signed) {
      console.error("[PATIENT-FILES] sign error:", signErr);
      return NextResponse.json(
        { error: "No se pudo generar el enlace" },
        { status: 500 }
      );
    }

    // Marcar como visto cuando lo abre el profesional
    if (isRecipientPro && !file.viewed_at) {
      await adminClient
        .from("patient_shared_files")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", id);
    }

    return NextResponse.json({
      url: signed.signedUrl,
      file_name: file.file_name,
      mime_type: file.mime_type,
    });
  } catch (error) {
    console.error("[PATIENT-FILES] download fatal:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
