-- Motivo de baja de la suscripción + feedback libre.
-- Se usan para analizar churn y mejorar el producto.
-- La suscripción sigue activa hasta subscription_expires_at (o trial_ends_at).
-- Cuando llegue esa fecha, un cron o el webhook de MP la pasa a status 'cancelled'.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_feedback TEXT;

COMMENT ON COLUMN professionals.cancellation_reason IS
  'Motivo principal de baja (ej: price_too_high, not_using, missing_features, switched_platform, closed_business, technical_issues, other).';

COMMENT ON COLUMN professionals.cancellation_feedback IS
  'Comentario libre del profesional al dar de baja. Opcional.';
