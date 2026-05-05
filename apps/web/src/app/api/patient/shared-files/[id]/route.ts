import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * DELETE /api/patient/shared-files/[id]
 *
 * El paciente borra un archivo que él mismo subió.
 */
export async function DELETE(
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

    const { data: file, error: fetchErr } = await adminClient
      .from("patient_shared_files")
      .select("id, file_path, patient_profile_id")
      .eq("id", id)
      .single();

    if (fetchErr || !file) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    if (file.patient_profile_id !== user.id) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    await supabase.storage.from("patient-shared-files").remove([file.file_path]);

    const { error: delErr } = await adminClient
      .from("patient_shared_files")
      .delete()
      .eq("id", id);

    if (delErr) {
      console.error("[PATIENT-FILES] DELETE error:", delErr);
      return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATIENT-FILES] DELETE fatal:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
