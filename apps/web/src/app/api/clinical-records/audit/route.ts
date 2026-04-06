import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinical-records/audit
 * Devuelve el log de auditoría de historia clínica para un paciente.
 *
 * Query params:
 *   - patient_id (requerido): UUID del paciente
 *   - limit (opcional): cantidad de registros (default 50, max 200)
 *   - offset (opcional): paginación
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!patientId) {
      return NextResponse.json({ error: "patient_id es requerido" }, { status: 400 });
    }

    // Verificar que el profesional tiene acceso a este paciente
    const { data: patientAccess } = await supabase
      .from("appointments")
      .select("id")
      .eq("professional_id", user.id)
      .eq("patient_id", patientId)
      .limit(1);

    if (!patientAccess || patientAccess.length === 0) {
      return NextResponse.json(
        { error: "No tienes acceso a los registros de este paciente" },
        { status: 403 }
      );
    }

    // Obtener IDs de los clinical_records de este profesional + paciente
    const { data: recordIds } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("professional_id", user.id)
      .eq("patient_id", patientId);

    if (!recordIds || recordIds.length === 0) {
      return NextResponse.json({ audit_logs: [], total: 0 });
    }

    const ids = recordIds.map((r) => r.id);

    // Obtener logs de auditoría con info del usuario que accedió
    const admin = createAdminClient();

    const { data: auditLogs, error: auditError, count } = await admin
      .from("clinical_record_audit")
      .select("id, record_id, accessed_by, action, accessed_at, ip_address, details", { count: "exact" })
      .in("record_id", ids)
      .order("accessed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (auditError) {
      console.error("Error fetching audit logs:", auditError.message);
      return NextResponse.json({ error: "Error al obtener logs de auditoría" }, { status: 500 });
    }

    // Enriquecer con nombres de usuario
    const userIds = [...new Set((auditLogs || []).map((l) => l.accessed_by))];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

    const enrichedLogs = (auditLogs || []).map((log) => ({
      id: log.id,
      record_id: log.record_id,
      accessed_by: log.accessed_by,
      accessed_by_name: profileMap.get(log.accessed_by) || "Usuario desconocido",
      action: log.action,
      accessed_at: log.accessed_at,
      ip_address: log.ip_address,
      details: log.details,
    }));

    return NextResponse.json({
      audit_logs: enrichedLogs,
      total: count || 0,
    });
  } catch (error) {
    console.error("Error GET /api/clinical-records/audit:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
