import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/professional/notifications
 *
 * Devuelve las notificaciones del profesional autenticado.
 * Por ahora: archivos enviados por sus pacientes (ordenados por más recientes
 * y con flag de pendiente de ver).
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

    // Mostramos archivos de los últimos 7 días. Después se purgan automáticamente
    // por el cron de cleanup, así que la query refleja exactamente lo disponible.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: files, error } = await adminClient
      .from("patient_shared_files")
      .select(
        "id, patient_id, patient_profile_id, file_name, file_size, mime_type, description, uploaded_at, viewed_at"
      )
      .eq("professional_id", user.id)
      .gte("uploaded_at", sevenDaysAgo)
      .order("uploaded_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[PRO-NOTIF] error:", error);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    // Enriquecer con el nombre del paciente desde la tabla patients
    const patientIds = [...new Set((files ?? []).map((f) => f.patient_id))];
    let patientMap: Record<string, { full_name: string }> = {};

    if (patientIds.length > 0) {
      const { data: patients } = await adminClient
        .from("patients")
        .select("id, full_name")
        .in("id", patientIds);
      patientMap = Object.fromEntries(
        (patients ?? []).map((p) => [p.id, { full_name: p.full_name }])
      );
    }

    const enriched = (files ?? []).map((f) => ({
      type: "shared_file" as const,
      id: f.id,
      patient_id: f.patient_id,
      patient_name: patientMap[f.patient_id]?.full_name ?? "Paciente",
      file_name: f.file_name,
      file_size: f.file_size,
      mime_type: f.mime_type,
      description: f.description,
      uploaded_at: f.uploaded_at,
      viewed_at: f.viewed_at,
    }));

    const unreadCount = enriched.filter((n) => !n.viewed_at).length;

    return NextResponse.json({ notifications: enriched, unread_count: unreadCount });
  } catch (error) {
    console.error("[PRO-NOTIF] fatal:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
