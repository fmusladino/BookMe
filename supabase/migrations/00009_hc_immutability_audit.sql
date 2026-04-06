-- ============================================================================
-- Migración 00009: Inmutabilidad de Historia Clínica + Log de Auditoría mejorado
-- ============================================================================
-- Cumplimiento: Ley 26.529 (Derechos del Paciente, Argentina)
-- Principio: Las entradas de HC son INMUTABLES una vez creadas.
--   - No se pueden eliminar.
--   - No se puede sobrescribir el contenido original.
--   - Solo se pueden agregar ENMIENDAS (amendment) que referencian la entrada original.
--   - El audit log es append-only e indestructible.
-- ============================================================================

-- ─── 1. Ampliar acciones del audit log ──────────────────────────────────────
-- Agregar 'delete', 'export', 'amendment' como acciones válidas
ALTER TABLE clinical_record_audit
  DROP CONSTRAINT IF EXISTS clinical_record_audit_action_check;

ALTER TABLE clinical_record_audit
  ADD CONSTRAINT clinical_record_audit_action_check
  CHECK (action IN ('read', 'create', 'update', 'delete', 'export', 'amendment'));

-- ─── 2. Agregar campo de detalle al audit log ──────────────────────────────
-- Para registrar metadata adicional (ej: motivo de enmienda, qué se intentó)
ALTER TABLE clinical_record_audit
  ADD COLUMN IF NOT EXISTS details jsonb DEFAULT NULL;

-- ─── 3. Desacoplar audit de la FK con CASCADE ──────────────────────────────
-- El CASCADE actual destruye los logs de auditoría cuando se borra un registro.
-- Cambiamos a SET NULL para preservar el trail incluso si el registro desaparece.
ALTER TABLE clinical_record_audit
  DROP CONSTRAINT IF EXISTS clinical_record_audit_record_id_fkey;

ALTER TABLE clinical_record_audit
  ALTER COLUMN record_id DROP NOT NULL;

ALTER TABLE clinical_record_audit
  ADD CONSTRAINT clinical_record_audit_record_id_fkey
  FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE SET NULL;

-- ─── 4. Columnas de inmutabilidad en clinical_records ──────────────────────
-- is_amendment: marca que esta entrada es una enmienda de otra
-- amends_record_id: referencia a la entrada original que se enmienda
-- is_archived: soft-delete (el profesional puede "archivar" pero nunca borrar)
ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS is_amendment boolean NOT NULL DEFAULT false;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS amends_record_id uuid DEFAULT NULL
  REFERENCES clinical_records(id) ON DELETE SET NULL;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Índice para buscar enmiendas de un registro
CREATE INDEX IF NOT EXISTS idx_clinical_records_amends
  ON clinical_records(amends_record_id)
  WHERE amends_record_id IS NOT NULL;

-- ─── 5. Trigger: bloquear DELETE en clinical_records ────────────────────────
-- Ningún usuario ni proceso puede eliminar una entrada de HC.
CREATE OR REPLACE FUNCTION prevent_clinical_record_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Las entradas de historia clínica no pueden ser eliminadas (Ley 26.529). Use el archivado en su lugar.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_clinical_record_delete ON clinical_records;
CREATE TRIGGER trg_prevent_clinical_record_delete
  BEFORE DELETE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION prevent_clinical_record_delete();

-- ─── 6. Trigger: bloquear UPDATE del contenido encriptado ───────────────────
-- Solo se permite actualizar is_archived (soft delete).
-- El contenido encriptado, iv, patient_id, professional_id son INMUTABLES.
CREATE OR REPLACE FUNCTION enforce_clinical_record_immutability()
RETURNS trigger AS $$
BEGIN
  -- Permitir cambio de is_archived (archivado/desarchivado)
  IF OLD.content_encrypted = NEW.content_encrypted
     AND OLD.iv = NEW.iv
     AND OLD.patient_id = NEW.patient_id
     AND OLD.professional_id = NEW.professional_id
     AND OLD.appointment_id IS NOT DISTINCT FROM NEW.appointment_id
     AND OLD.is_amendment = NEW.is_amendment
     AND OLD.amends_record_id IS NOT DISTINCT FROM NEW.amends_record_id
  THEN
    -- Solo cambió is_archived u updated_at → permitido
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'El contenido de la historia clínica es inmutable (Ley 26.529). Cree una enmienda en su lugar.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_clinical_record_immutability ON clinical_records;
CREATE TRIGGER trg_enforce_clinical_record_immutability
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION enforce_clinical_record_immutability();

-- ─── 7. Trigger: hacer audit log verdaderamente inmutable ───────────────────
-- Bloquear UPDATE y DELETE en clinical_record_audit
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría son inmutables y no pueden ser modificados ni eliminados.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON clinical_record_audit;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON clinical_record_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON clinical_record_audit;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON clinical_record_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- ─── 8. RLS: permitir al paciente leer audit de su propia HC ────────────────
-- (Para transparencia — el paciente puede ver quién accedió a su HC)
CREATE POLICY "Auditoría HC: lectura por paciente"
  ON clinical_record_audit
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM clinical_records cr
      JOIN patients p ON p.id = cr.patient_id
      WHERE cr.id = record_id AND p.profile_id = auth.uid()
    )
  );

-- ─── 9. Índice para consultas de audit por usuario ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_accessed_by
  ON clinical_record_audit(accessed_by, accessed_at DESC);
