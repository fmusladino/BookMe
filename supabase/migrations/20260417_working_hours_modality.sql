-- Agrega modalidad por franja horaria en working_hours.
-- El profesional puede marcar cada franja como presencial, virtual o both
-- para controlar qué tipos de servicios pueden reservarse en cada rango.
-- Default 'both' para no bloquear datos existentes.

ALTER TABLE working_hours
  ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'both'
    CHECK (modality IN ('presencial', 'virtual', 'both'));

COMMENT ON COLUMN working_hours.modality IS
  'Modalidad permitida en esta franja: presencial | virtual | both. Se cruza con services.modality para mostrar/validar disponibilidad.';
