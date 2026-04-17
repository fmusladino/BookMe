-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS clinical_record_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    uuid NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  accessed_by  uuid NOT NULL REFERENCES profiles(id),
  action       text NOT NULL,
  accessed_at  timestamptz NOT NULL DEFAULT now(),
  ip_address   inet,
  details      jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_record ON clinical_record_audit(record_id, accessed_at DESC);

-- Eliminar CHECK constraint viejo que solo permitía read/create/update
-- (ahora también necesitamos export, delete, amendment)
DO $$
BEGIN
  -- Intentar eliminar el constraint existente
  ALTER TABLE clinical_record_audit DROP CONSTRAINT IF EXISTS clinical_record_audit_action_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Agregar nuevo CHECK que incluye todas las acciones
ALTER TABLE clinical_record_audit
  ADD CONSTRAINT clinical_record_audit_action_check
  CHECK (action IN ('read', 'create', 'update', 'delete', 'export', 'amendment'));

-- Agregar columna details si no existe
DO $$
BEGIN
  ALTER TABLE clinical_record_audit ADD COLUMN details jsonb;
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

-- RLS
ALTER TABLE clinical_record_audit ENABLE ROW LEVEL SECURITY;

-- Política: profesional puede ver auditoría de sus propios registros
DO $$
BEGIN
  CREATE POLICY "professional_read_own_audit"
    ON clinical_record_audit FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM clinical_records cr
        WHERE cr.id = clinical_record_audit.record_id
        AND cr.professional_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
