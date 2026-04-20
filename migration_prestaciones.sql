-- ============================================================
-- BookMe — Migración: Tabla de Prestaciones (Healthcare)
-- Cada profesional healthcare puede cargar prestaciones
-- por obra social/prepaga con código, descripción, valor y vigencia
-- ============================================================

-- ─── prestaciones ───────────────────────────────────────────
CREATE TABLE prestaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  insurance_id     uuid NOT NULL REFERENCES insurances(id) ON DELETE CASCADE,
  code             text NOT NULL,                          -- código de práctica / nomenclador
  description      text NOT NULL,                          -- descripción de la prestación
  amount           numeric(10,2) NOT NULL,                 -- valor en pesos
  valid_from       date NOT NULL DEFAULT CURRENT_DATE,     -- vigencia desde
  valid_until      date,                                   -- vigencia hasta (NULL = indefinida)
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_prestaciones_professional ON prestaciones(professional_id);
CREATE INDEX idx_prestaciones_insurance ON prestaciones(professional_id, insurance_id);
CREATE INDEX idx_prestaciones_active ON prestaciones(professional_id, is_active) WHERE is_active = true;

-- Trigger updated_at
CREATE TRIGGER prestaciones_updated_at
  BEFORE UPDATE ON prestaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE prestaciones ENABLE ROW LEVEL SECURITY;

-- Profesional ve solo sus prestaciones
CREATE POLICY prestaciones_select_own ON prestaciones
  FOR SELECT USING (professional_id = auth.uid());

CREATE POLICY prestaciones_insert_own ON prestaciones
  FOR INSERT WITH CHECK (professional_id = auth.uid());

CREATE POLICY prestaciones_update_own ON prestaciones
  FOR UPDATE USING (professional_id = auth.uid());

CREATE POLICY prestaciones_delete_own ON prestaciones
  FOR DELETE USING (professional_id = auth.uid());

-- Service role (admin) puede todo
CREATE POLICY prestaciones_service_role ON prestaciones
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Agregar prestacion_id a appointments (opcional) ────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prestacion_id uuid REFERENCES prestaciones(id);
CREATE INDEX IF NOT EXISTS idx_appointments_prestacion ON appointments(prestacion_id) WHERE prestacion_id IS NOT NULL;
