-- ============================================================
-- BookMe — Migración: payments y payment_reminders
--
-- Implementa el motor de cobros mensuales (#27 del MVP):
--   - Histórico de cobros vía MercadoPago
--   - Log de recordatorios enviados (día 7 / 10 / 14)
--   - Soporte para corte automático a read_only el día 15
--
-- Las tablas las pobla:
--   - el webhook de MercadoPago (apps/web/src/app/api/webhooks/mercadopago)
--   - el cron diario   (apps/web/src/app/api/cron/billing-reminders)
-- ============================================================

-- ─── Enums ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_reminder_kind AS ENUM ('soft', 'firm', 'final', 'read_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── payments ───────────────────────────────────────────────
-- Histórico de intentos de cobro de la suscripción del profesional
CREATE TABLE IF NOT EXISTS payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id   uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  -- Período cubierto por este intento: año-mes (ej. 2026-04)
  period_year       int NOT NULL CHECK (period_year BETWEEN 2024 AND 2099),
  period_month      int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount            numeric(10,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'ARS',
  status            payment_status NOT NULL DEFAULT 'pending',
  -- Datos de MercadoPago para trazabilidad
  mp_payment_id     text UNIQUE,
  mp_subscription_id text,
  failure_reason    text,
  attempted_at      timestamptz NOT NULL DEFAULT now(),
  paid_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_professional_period
  ON payments(professional_id, period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status, attempted_at DESC);

-- Un único payment por profesional + mes (idempotencia para webhook MP)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_pro_period
  ON payments(professional_id, period_year, period_month);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE payments IS 'Histórico de cobros mensuales de suscripción vía MercadoPago';

-- ─── payment_reminders ──────────────────────────────────────
-- Log de recordatorios enviados al profesional cuando un payment falla
CREATE TABLE IF NOT EXISTS payment_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  -- soft = día 7, firm = día 10, final = día 14, read_only = día 15
  kind            payment_reminder_kind NOT NULL,
  -- Canales por los que se mandó (CSV: "email,whatsapp")
  channels        text NOT NULL DEFAULT '',
  sent_at         timestamptz NOT NULL DEFAULT now(),
  -- Día desde el fallo cuando se disparó (7, 10, 14, 15) — útil para auditar
  days_overdue    int NOT NULL,
  UNIQUE (payment_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_pro
  ON payment_reminders(professional_id, sent_at DESC);

COMMENT ON TABLE payment_reminders IS 'Log de recordatorios de impago enviados (uno por payment+kind)';

-- ─── Campo en professionals: marcar el inicio del impago ────
-- Permite calcular "días en mora" sin consultar payments en cada query.
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;

COMMENT ON COLUMN professionals.past_due_since IS
  'Timestamp del primer payment fallido del ciclo actual. NULL si está al día.';

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- payments: el profesional ve sus propios cobros, superadmin ve todo.
CREATE POLICY "Pagos: vista propia del profesional" ON payments
  FOR SELECT USING (professional_id = auth.uid());

CREATE POLICY "Pagos: superadmin gestiona todo" ON payments
  FOR ALL USING (is_superadmin());

-- payment_reminders: idem
CREATE POLICY "Recordatorios: vista propia del profesional" ON payment_reminders
  FOR SELECT USING (professional_id = auth.uid());

CREATE POLICY "Recordatorios: superadmin gestiona todo" ON payment_reminders
  FOR ALL USING (is_superadmin());

-- ─── Vista de mora para el panel admin ──────────────────────
-- Combina professionals + último payment fallido + último reminder.
CREATE OR REPLACE VIEW v_overdue_professionals AS
SELECT
  p.id                                  AS professional_id,
  pr.full_name,
  p.subscription_plan,
  p.subscription_status,
  p.past_due_since,
  EXTRACT(DAY FROM (now() - p.past_due_since))::int AS days_overdue,
  last_pay.id                           AS last_payment_id,
  last_pay.amount                       AS last_payment_amount,
  last_pay.failure_reason               AS last_failure_reason,
  last_pay.attempted_at                 AS last_attempt_at,
  last_rem.kind                         AS last_reminder_kind,
  last_rem.sent_at                      AS last_reminder_at
FROM professionals p
JOIN profiles pr ON pr.id = p.id
LEFT JOIN LATERAL (
  SELECT id, amount, failure_reason, attempted_at
  FROM payments
  WHERE professional_id = p.id AND status = 'failed'
  ORDER BY attempted_at DESC
  LIMIT 1
) last_pay ON true
LEFT JOIN LATERAL (
  SELECT kind, sent_at
  FROM payment_reminders
  WHERE professional_id = p.id
  ORDER BY sent_at DESC
  LIMIT 1
) last_rem ON true
WHERE p.subscription_status IN ('past_due', 'read_only')
  AND p.past_due_since IS NOT NULL;

COMMENT ON VIEW v_overdue_professionals IS
  'Lista de profesionales con pagos atrasados — alimenta /admin/cobros';
