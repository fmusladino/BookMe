-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Fecha: 2026-04-16
-- Descripción: Corrige vulnerabilidades identificadas en auditoría
-- ============================================================

-- ─── 1. RLS para clinical_attachments (CRITICAL) ───────────
-- La tabla tenía RLS en storage.objects pero NO en la tabla misma
ALTER TABLE clinical_attachments ENABLE ROW LEVEL SECURITY;

-- Solo el profesional propietario puede ver sus adjuntos
DO $$
BEGIN
  CREATE POLICY "professional_read_own_attachments"
    ON clinical_attachments FOR SELECT
    USING (professional_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Solo el profesional propietario puede insertar adjuntos para sus registros
DO $$
BEGIN
  CREATE POLICY "professional_insert_own_attachments"
    ON clinical_attachments FOR INSERT
    WITH CHECK (
      professional_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM clinical_records cr
        WHERE cr.id = clinical_attachments.record_id
        AND cr.professional_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Bloquear UPDATE (los adjuntos son inmutables)
DO $$
BEGIN
  CREATE POLICY "deny_update_attachments"
    ON clinical_attachments FOR UPDATE
    USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DELETE ya está bloqueado por el trigger prevent_clinical_attachment_delete

-- ─── 2. RLS refuerzo para clinical_record_audit ────────────
-- Asegurar que solo admin o el profesional propietario pueden insertar auditoría
DO $$
BEGIN
  CREATE POLICY "system_insert_audit"
    ON clinical_record_audit FOR INSERT
    WITH CHECK (accessed_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Índice para mejorar performance de RLS en clinical_records ──
CREATE INDEX IF NOT EXISTS idx_clinical_records_professional_patient
  ON clinical_records(professional_id, patient_id);

-- ─── 4. Reforzar constraint en clinical_attachments.mime_type ──────
ALTER TABLE clinical_attachments DROP CONSTRAINT IF EXISTS clinical_attachments_mime_check;
ALTER TABLE clinical_attachments
  ADD CONSTRAINT clinical_attachments_mime_check
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));

-- ─── 5. Limitar tamaño de archivo a nivel de DB (defense in depth) ──
ALTER TABLE clinical_attachments DROP CONSTRAINT IF EXISTS clinical_attachments_size_check;
ALTER TABLE clinical_attachments
  ADD CONSTRAINT clinical_attachments_size_check
  CHECK (file_size > 0 AND file_size <= 10485760); -- 10 MB

-- ─── 6. Limitar longitud de file_name para prevenir path traversal ──
ALTER TABLE clinical_attachments DROP CONSTRAINT IF EXISTS clinical_attachments_filename_check;
ALTER TABLE clinical_attachments
  ADD CONSTRAINT clinical_attachments_filename_check
  CHECK (length(file_name) <= 255 AND file_name !~ '\.\.' AND file_name !~ '/');
