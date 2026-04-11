-- ─── professional_insurances ────────────────────────────────
-- Tabla de relación entre profesionales y sus obras sociales/prepagas.
-- Cada profesional gestiona su propia lista desde Configuración.
-- La tabla insurances sigue siendo el catálogo global; esta tabla
-- indica cuáles habilitó cada profesional.

CREATE TABLE IF NOT EXISTS professional_insurances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  insurance_id    uuid NOT NULL REFERENCES insurances(id) ON DELETE CASCADE,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(professional_id, insurance_id)
);

CREATE INDEX idx_prof_insurances_professional ON professional_insurances(professional_id);
CREATE INDEX idx_prof_insurances_active ON professional_insurances(professional_id) WHERE is_active = true;

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE professional_insurances ENABLE ROW LEVEL SECURITY;

-- El profesional solo ve/gestiona sus propias obras sociales
CREATE POLICY professional_insurances_select ON professional_insurances
  FOR SELECT USING (
    professional_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY professional_insurances_insert ON professional_insurances
  FOR INSERT WITH CHECK (
    professional_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY professional_insurances_update ON professional_insurances
  FOR UPDATE USING (
    professional_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY professional_insurances_delete ON professional_insurances
  FOR DELETE USING (
    professional_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Service role bypass
CREATE POLICY professional_insurances_service ON professional_insurances
  FOR ALL TO service_role USING (true) WITH CHECK (true);
