import { createAdminClient } from "@/lib/supabase/server";

const RETENTION_DAYS = 7;
const BUCKET = "patient-shared-files";

/**
 * Borra archivos compartidos por pacientes con más de RETENTION_DAYS días
 * de antigüedad. Limpia tanto la fila en la tabla como el blob en storage.
 *
 * Pensado para invocar desde un cron diario. Es idempotente y best-effort:
 * si el storage falla para un archivo individual, igual elimina el resto.
 */
export async function cleanupExpiredSharedFiles(): Promise<{
  deleted: number;
  errors: number;
}> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: fetchError } = await admin
    .from("patient_shared_files")
    .select("id, file_path")
    .lt("uploaded_at", cutoff)
    .limit(500);

  if (fetchError) {
    console.error("[shared-files cleanup] fetch error:", fetchError);
    return { deleted: 0, errors: 1 };
  }

  if (!expired || expired.length === 0) {
    return { deleted: 0, errors: 0 };
  }

  // Borrar blobs del storage en bulk (max 1000 por llamada según docs)
  const paths = expired.map((f) => f.file_path);
  const { error: storageError } = await admin.storage.from(BUCKET).remove(paths);
  if (storageError) {
    console.error("[shared-files cleanup] storage remove error:", storageError);
    // Continuamos: borrar la fila igual evita acumular registros huérfanos.
  }

  const ids = expired.map((f) => f.id);
  const { error: deleteError } = await admin
    .from("patient_shared_files")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.error("[shared-files cleanup] delete error:", deleteError);
    return { deleted: 0, errors: 1 };
  }

  return { deleted: ids.length, errors: 0 };
}
