-- ============================================================
-- BookMe — Migración: Obras sociales por servicio
-- Vincula qué obras sociales/prepagas acepta cada servicio
-- ============================================================

CREATE TABLE service_insurances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  insurance_id uuid NOT NULL REFERENCES insurances(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, insurance_id)
);

CREATE INDEX idx_service_insurances_service ON service_insurances(service_id);
CREATE INDEX idx_service_insurances_insurance ON service_insurances(insurance_id);

-- RLS
ALTER TABLE service_insurances ENABLE ROW LEVEL SECURITY;

-- El profesional puede gestionar las OS de sus propios servicios
CREATE POLICY service_insurances_select ON service_insurances
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM services WHERE services.id = service_insurances.service_id AND services.professional_id = auth.uid())
  );

CREATE POLICY service_insurances_insert ON service_insurances
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM services WHERE services.id = service_insurances.service_id AND services.professional_id = auth.uid())
  );

CREATE POLICY service_insurances_delete ON service_insurances
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM services WHERE services.id = service_insurances.service_id AND services.professional_id = auth.uid())
  );

-- Lectura pública para la web
CREATE POLICY service_insurances_public_read ON service_insurances
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM services WHERE services.id = service_insurances.service_id AND services.is_active = true)
  );

-- Service role
CREATE POLICY service_insurances_service_role ON service_insurances
  FOR ALL USING (auth.role() = 'service_role');
