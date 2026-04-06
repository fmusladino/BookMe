-- Agrega campo para trackear qué emails de trial ya se enviaron
-- Formato: CSV de hitos ("7d,3d,0d,expired")
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS trial_email_sent text DEFAULT '';
