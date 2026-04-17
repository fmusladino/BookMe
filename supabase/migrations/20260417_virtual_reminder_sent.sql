-- Flag para evitar enviar dos veces el recordatorio 5 min antes
-- de una videoconsulta. Se setea en true cuando el cron /api/cron/virtual-reminders
-- envía el aviso.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS virtual_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice parcial para que el cron encuentre rápido solo los que faltan avisar
CREATE INDEX IF NOT EXISTS idx_appointments_virtual_reminder_pending
  ON appointments (starts_at)
  WHERE modality = 'virtual'
    AND meet_url IS NOT NULL
    AND virtual_reminder_sent = FALSE
    AND status IN ('confirmed', 'pending');
