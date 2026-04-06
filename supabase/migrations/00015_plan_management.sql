-- ============================================================
-- BookMe — Migración: ABM de planes y features configurables
-- Permite gestionar planes, precios y features desde el admin
-- ============================================================

-- ─── Tabla: definición de features disponibles ──────────────
CREATE TABLE IF NOT EXISTS feature_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'general',
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE feature_definitions IS 'Catálogo maestro de features configurables del sistema';

CREATE TRIGGER feature_definitions_updated_at
  BEFORE UPDATE ON feature_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Tabla: features asignadas por plan y línea ─────────────
CREATE TABLE IF NOT EXISTS plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line        line_of_business NOT NULL,
  plan        subscription_plan NOT NULL,
  feature_id  uuid NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line, plan, feature_id)
);

COMMENT ON TABLE plan_features IS 'Matriz de features habilitadas por línea + plan';

CREATE TRIGGER plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Lectura pública (la app necesita leer features para gating)
CREATE POLICY "Features: lectura pública" ON feature_definitions
  FOR SELECT USING (true);

CREATE POLICY "Plan features: lectura pública" ON plan_features
  FOR SELECT USING (true);

-- Escritura solo superadmin
CREATE POLICY "Features: gestión superadmin" ON feature_definitions
  FOR ALL USING (is_superadmin());

CREATE POLICY "Plan features: gestión superadmin" ON plan_features
  FOR ALL USING (is_superadmin());

-- ─── Seed: features iniciales ───────────────────────────────
INSERT INTO feature_definitions (key, label, description, category, sort_order) VALUES
  ('mia_basic',           'MIA Básica',               'Chat flotante con consultas sobre agenda',                     'mia',          10),
  ('mia_advanced',        'MIA Avanzada',             'Crear/cancelar/bloquear turnos por texto con confirmación',    'mia',          20),
  ('mia_transcription',   'MIA Transcripción HC',     'Transcripción automática para historia clínica (Premium HC)',  'mia',          30),
  ('push_notifications',  'Push Notifications',       'Notificaciones push al celular del profesional',               'notificaciones', 40),
  ('dashboard_financial', 'Dashboard Financiero',     'Ingresos particulares + OS pendiente de cobro',                'metricas',     50),
  ('insurance_billing',   'Liquidación Obra Social',  'Carga de valor por práctica y OS para liquidación',            'facturacion',  60),
  ('afip_billing',        'Facturación AFIP',         'Integración AFIP vía Facturante/Factura.ai',                   'facturacion',  70),
  ('service_catalog',     'Catálogo de Servicios',    'Lista de servicios con precio opcional',                       'servicios',    80),
  ('reports_export',      'Exportar Reportes',        'Exportar métricas y reportes en PDF/Excel',                    'metricas',     90),
  ('multiple_locations',  'Múltiples Sucursales',     'Gestionar agenda en más de una ubicación',                     'agenda',       100),
  ('whatsapp_own_number', 'WhatsApp Propio',          'Enviar recordatorios desde número propio (no BookMe)',         'notificaciones', 110),
  ('qr_custom',           'QR Personalizado',         'Código QR con branding propio para compartir perfil',          'marketing',    120)
ON CONFLICT (key) DO NOTHING;

-- ─── Seed: matriz de features por plan (replica feature-flags.ts) ───
-- Se usa una función para insertar masivamente

DO $$
DECLARE
  feat_id uuid;
  feat_key text;
BEGIN
  -- Healthcare features
  FOR feat_id, feat_key IN SELECT id, key FROM feature_definitions LOOP
    -- Free: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'free', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Base: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'base', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Standard HC
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'standard', feat_id,
      feat_key IN ('mia_basic','mia_advanced','push_notifications','dashboard_financial','insurance_billing','afip_billing','service_catalog','reports_export','qr_custom')
    )
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Premium HC: todo habilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'premium', feat_id, true)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Business free: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'free', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Business base: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'base', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Standard Business
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'standard', feat_id,
      feat_key IN ('mia_basic','mia_advanced','push_notifications','service_catalog','reports_export','qr_custom')
    )
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Premium Business
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'premium', feat_id,
      feat_key IN ('mia_basic','mia_advanced','push_notifications','service_catalog','reports_export','multiple_locations','whatsapp_own_number','qr_custom')
    )
    ON CONFLICT (line, plan, feature_id) DO NOTHING;
  END LOOP;
END $$;

-- ─── Tabla: precios de planes de consultorio ────────────────
CREATE TABLE IF NOT EXISTS clinic_plan_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan          text NOT NULL CHECK (plan IN ('small', 'large')),
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  price_usd     numeric(10,2) NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan, billing_cycle)
);

COMMENT ON TABLE clinic_plan_prices IS 'Precios de referencia para planes de consultorio (solo Healthcare)';

CREATE TRIGGER clinic_plan_prices_updated_at
  BEFORE UPDATE ON clinic_plan_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic plan prices: lectura pública" ON clinic_plan_prices
  FOR SELECT USING (true);

CREATE POLICY "Clinic plan prices: gestión superadmin" ON clinic_plan_prices
  FOR ALL USING (is_superadmin());

-- Seed precios de consultorio
INSERT INTO clinic_plan_prices (plan, billing_cycle, price_usd) VALUES
  ('small', 'monthly', 79.00),
  ('small', 'annual', 854.00),
  ('large', 'monthly', 149.00),
  ('large', 'annual', 1610.00)
ON CONFLICT (plan, billing_cycle) DO NOTHING;
