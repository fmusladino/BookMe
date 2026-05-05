import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/patients/[id]/shared-files
 *
 * Lista los archivos que el paciente envió al profesional autenticado.
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
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: patientId } = await params;

    // Validar que el paciente pertenece al profesional
    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("professional_id", user.id)
      .single();

    if (patientErr || !patient) {
      return NextResponse.json(
        { error: "Paciente no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("patient_shared_files")
      .select(
        "id, file_name, file_size, mime_type, description, uploaded_at, viewed_at"
      )
      .eq("professional_id", user.id)
      .eq("patient_id", patientId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("[PRO-SHARED-FILES] error:", error);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    return NextResponse.json({ files: data ?? [] });
  } catch (error) {
    console.error("[PRO-SHARED-FILES] fatal:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
