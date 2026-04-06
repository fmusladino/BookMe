-- ============================================================
-- BookMe — Migración: actualización de planes de suscripción
-- Agrega tier 'base', billing cycle, suscripciones de consultorio,
-- datos de retención y campos de cancelación
-- ============================================================

-- ─── Actualizar enum subscription_plan ───────────────────────
-- Renombrar 'free' a 'base' no es posible en PostgreSQL.
-- Agregamos 'base' y dejamos 'free' como estado sin plan activo.
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'base' AFTER 'free';

-- ─── Enum para ciclo de facturación ─────────────────────────
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');

-- ─── Nuevos campos en professionals ─────────────────────────
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS mp_plan_id text;

-- Comentarios para documentar la lógica de negocio
COMMENT ON COLUMN professionals.billing_cycle IS 'monthly o annual — afecta el descuento (20% anual)';
COMMENT ON COLUMN professionals.subscription_expires_at IS 'Fecha de expiración del período actual';
COMMENT ON COLUMN professionals.cancelled_at IS 'Fecha en que el profesional canceló su cuenta';
COMMENT ON COLUMN professionals.data_retention_until IS 'Fecha límite de retención de datos (90 días post-cancelación)';
COMMENT ON COLUMN professionals.mp_plan_id IS 'ID del plan en MercadoPago para distinguir base/standard/premium';

-- ─── Tabla: suscripciones de consultorio ─────────────────────
CREATE TABLE clinic_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid UNIQUE NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan                text NOT NULL CHECK (plan IN ('small', 'large')),
  billing_cycle       billing_cycle NOT NULL DEFAULT 'monthly',
  status              subscription_status NOT NULL DEFAULT 'trialing',
  max_professionals   int NOT NULL DEFAULT 10,
  price_usd           numeric(10,2) NOT NULL,
  trial_ends_at       timestamptz,
  subscription_expires_at timestamptz,
  mp_subscription_id  text,
  mp_plan_id          text,
  cancelled_at        timestamptz,
  data_retention_until timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinic_subscriptions IS 'Suscripciones de consultorios — solo Healthcare';
COMMENT ON COLUMN clinic_subscriptions.plan IS 'small = hasta 10 profes (USD 79), large = 11+ profes (USD 149)';

CREATE TRIGGER clinic_subscriptions_updated_at
  BEFORE UPDATE ON clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS para clinic_subscriptions ───────────────────────────
ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suscripción clínica: lectura por dueño y admins" ON clinic_subscriptions
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid()
    )
    OR EXISTS(
      SELECT 1 FROM clinic_admins WHERE clinic_id = clinic_subscriptions.clinic_id AND profile_id = auth.uid()
    )
    OR is_superadmin()
  );

CREATE POLICY "Suscripción clínica: gestión por dueño" ON clinic_subscriptions
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid()
    )
    OR is_superadmin()
  );

-- ─── Tabla: precios de planes (referencia, no facturación) ───
CREATE TABLE plan_prices (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line  line_of_business NOT NULL,
  plan  subscription_plan NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  price_usd numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(line, plan, billing_cycle)
);

COMMENT ON TABLE plan_prices IS 'Tabla de referencia con precios vigentes por línea/plan/ciclo';

-- Insertar precios vigentes
INSERT INTO plan_prices (line, plan, billing_cycle, price_usd) VALUES
  -- Healthcare mensual
  ('healthcare', 'base',     'monthly', 9.00),
  ('healthcare', 'standard', 'monthly', 15.00),
  ('healthcare', 'premium',  'monthly', 20.00),
  -- Healthcare anual (20% descuento)
  ('healthcare', 'base',     'annual', 7.20),
  ('healthcare', 'standard', 'annual', 12.00),
  ('healthcare', 'premium',  'annual', 16.00),
  -- Business mensual
  ('business', 'base',     'monthly', 7.00),
  ('business', 'standard', 'monthly', 14.00),
  ('business', 'premium',  'monthly', 25.00),
  -- Business anual (20% descuento)
  ('business', 'base',     'annual', 5.60),
  ('business', 'standard', 'annual', 11.20),
  ('business', 'premium',  'annual', 20.00);

-- plan_prices: lectura pública, escritura solo superadmin
ALTER TABLE plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Precios: lectura pública" ON plan_prices
  FOR SELECT USING (true);

CREATE POLICY "Precios: gestión superadmin" ON plan_prices
  FOR ALL USING (is_superadmin());
