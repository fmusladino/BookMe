-- ═══════════════════════════════════════════════════════════════
-- BookMe — Migración: estado "completed" + pago total en court_bookings
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Nuevas columnas para tracking de pago y finalización
ALTER TABLE court_bookings ADD COLUMN IF NOT EXISTS payment_completed boolean NOT NULL DEFAULT false;
ALTER TABLE court_bookings ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE court_bookings ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Comentarios para documentación
COMMENT ON COLUMN court_bookings.payment_completed IS 'true cuando el cliente pagó el total de la cancha';
COMMENT ON COLUMN court_bookings.payment_method IS 'Método de pago: efectivo, transferencia, mercadopago, etc.';
COMMENT ON COLUMN court_bookings.completed_at IS 'Timestamp de cuando se finalizó/completó el turno';
