-- ─── Onboarding status para profesionales ───────────────────
-- Indica si el profesional ya completó o saltó el tour de bienvenida.
-- false = mostrar onboarding, true = ya lo vio.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- También agregar campo para trackear cuándo lo completó
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
