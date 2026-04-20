-- ============================================================
-- Recordatorios configurables por profesional
-- El profesional elige cuántos y cuándo (offsets en minutos antes del turno)
-- y por qué canal se envían (email / whatsapp).
-- ============================================================

-- reminder_offsets: array de minutos antes del turno. Ej: {2880, 1440, 120}
--                   = 48hs, 24hs y 2hs antes.
-- reminder_channels: subset de {email, whatsapp}. Si está vacío, no se envían.
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS reminder_offsets  int[] NOT NULL DEFAULT ARRAY[1440]::int[],
  ADD COLUMN IF NOT EXISTS reminder_channels text[] NOT NULL DEFAULT ARRAY['email','whatsapp']::text[];

-- Validaciones de negocio:
-- - cada offset debe ser > 0 (no tiene sentido 0 o negativo)
-- - cada offset debe ser <= 7 días (10080 min) para no revisar ventanas absurdas
-- - canales permitidos solo 'email' o 'whatsapp'
ALTER TABLE professionals
  DROP CONSTRAINT IF EXISTS professionals_reminder_offsets_check;
ALTER TABLE professionals
  ADD  CONSTRAINT professionals_reminder_offsets_check
  CHECK (
    array_length(reminder_offsets, 1) IS NULL
    OR (
      array_length(reminder_offsets, 1) <= 5
      AND NOT EXISTS (
        SELECT 1 FROM unnest(reminder_offsets) AS o
        WHERE o <= 0 OR o > 10080
      )
    )
  );

ALTER TABLE professionals
  DROP CONSTRAINT IF EXISTS professionals_reminder_channels_check;
ALTER TABLE professionals
  ADD  CONSTRAINT professionals_reminder_channels_check
  CHECK (reminder_channels <@ ARRAY['email','whatsapp']::text[]);

-- ─── Tabla de log: qué offsets ya se enviaron por turno ─────
-- Evita duplicados si el cron corre varias veces dentro de la misma ventana.
CREATE TABLE IF NOT EXISTS appointment_reminders_sent (
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  offset_minutes int  NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, offset_minutes)
);

CREATE INDEX IF NOT EXISTS idx_reminders_sent_appointment
  ON appointment_reminders_sent(appointment_id);

-- RLS: el profesional dueño del turno puede ver sus logs. El cron usa service_role.
ALTER TABLE appointment_reminders_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reminders_sent_owner_select ON appointment_reminders_sent;
CREATE POLICY reminders_sent_owner_select
  ON appointment_reminders_sent FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments WHERE professional_id = auth.uid()
    )
  );

-- Backfill: si un turno ya tenía reminder_sent = true, registrarlo como offset 1440
-- para no volver a enviarlo con el nuevo sistema.
INSERT INTO appointment_reminders_sent (appointment_id, offset_minutes, sent_at)
SELECT id, 1440, COALESCE(updated_at, created_at)
FROM appointments
WHERE reminder_sent = true
ON CONFLICT (appointment_id, offset_minutes) DO NOTHING;
