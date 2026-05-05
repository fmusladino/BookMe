import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
};

/**
 * GET /api/patient/shared-files
 *
 * Lista los archivos que el paciente autenticado le envió a sus profesionales.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: files, error } = await adminClient
      .from("patient_shared_files")
      .select(
        "id, patient_id, professional_id, file_name, file_size, mime_type, description, uploaded_at, viewed_at"
      )
      .eq("patient_profile_id", user.id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("[PATIENT-FILES] GET error:", error);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    const proIds = [...new Set((files ?? []).map((f) => f.professional_id))];
    let profileMap: Record<string, { full_name: string }> = {};
    if (proIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", proIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, { full_name: p.full_name }])
      );
    }

    const enriched = (files ?? []).map((f) => ({
      ...f,
      professional_name:
        profileMap[f.professional_id]?.full_name ?? "Profesional",
    }));

    return NextResponse.json({ files: enriched });
  } catch (error) {
    console.error("[PATIENT-FILES] GET fatal:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/patient/shared-files
 *
 * Sube un archivo y lo asocia a un profesional del paciente.
 * Body: FormData con `file`, `patient_id` (id en tabla patients) y `description` opcional.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar rol paciente
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "patient") {
      return NextResponse.json({ error: "Solo pacientes" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const patientId = formData.get("patient_id") as string | null;
    const description = (formData.get("description") as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (!patientId) {
      return NextResponse.json({ error: "Profesional requerido" }, { status: 400 });
    }

    // Validar tipo MIME y extensión
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usá PDF, JPG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }
    const ext = ("." + (file.name.split(".").pop() || "")).toLowerCase();
    const allowedMimes = ALLOWED_EXTENSIONS[ext];
    if (!allowedMimes || !allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: "La extensión no coincide con el formato del archivo." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera los 15 MB permitidos." },
        { status: 400 }
      );
    }

    // Validar que el patient_id corresponde al usuario autenticado
    const { data: patientRow, error: patientErr } = await adminClient
      .from("patients")
      .select("id, professional_id, profile_id")
      .eq("id", patientId)
      .single();

    if (patientErr || !patientRow || patientRow.profile_id !== user.id) {
      return NextResponse.json(
        { error: "Profesional no válido para este paciente" },
        { status: 403 }
      );
    }

    // Path: <patient_profile_id>/<professional_id>/<timestamp>-<sanitized_name>
    const safeName = file.name
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 100);
    const filePath = `${user.id}/${patientRow.professional_id}/${Date.now()}-${safeName}`;

    // Asegurar que el bucket exista (idempotente). Esto evita el "Bucket not found"
    // cuando la migración aún no creó el bucket en este entorno.
    const { data: buckets } = await adminClient.storage.listBuckets();
    const exists = (buckets ?? []).some((b) => b.id === "patient-shared-files");
    if (!exists) {
      const { error: createBucketError } = await adminClient.storage.createBucket(
        "patient-shared-files",
        { public: false }
      );
      if (createBucketError && !/already exists/i.test(createBucketError.message)) {
        console.error("[PATIENT-FILES] create bucket error:", createBucketError);
        return NextResponse.json(
          { error: `Error al preparar el almacenamiento: ${createBucketError.message}` },
          { status: 500 }
        );
      }
    }

    // Subimos con el admin client: ya validamos que el usuario es paciente
    // y que el patient_id le pertenece, así que no necesitamos depender de
    // las políticas RLS del bucket.
    const { error: uploadError } = await adminClient.storage
      .from("patient-shared-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[PATIENT-FILES] upload error:", uploadError);
      return NextResponse.json(
        { error: `Error al subir el archivo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: inserted, error: insertError } = await adminClient
      .from("patient_shared_files")
      .insert({
        patient_profile_id: user.id,
        patient_id: patientRow.id,
        professional_id: patientRow.professional_id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        description,
      })
      .select(
        "id, patient_id, professional_id, file_name, file_size, mime_type, description, uploaded_at, viewed_at"
      )
      .single();

    if (insertError || !inserted) {
      // Si falla el insert, limpiar el archivo subido
      await adminClient.storage.from("patient-shared-files").remove([filePath]);
      console.error("[PATIENT-FILES] insert error:", insertError);
      const detail = insertError?.message || "tabla patient_shared_files no disponible";
      return NextResponse.json(
        { error: `Error al registrar el archivo: ${detail}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ file: inserted }, { status: 201 });
  } catch (error) {
    console.error("[PATIENT-FILES] POST fatal:", error);
    const detail = error instanceof Error ? error.message : "desconocido";
    return NextResponse.json({ error: `Error interno: ${detail}` }, { status: 500 });
  }
}
