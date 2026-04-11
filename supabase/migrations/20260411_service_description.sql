-- Agregar campo descripción a servicios
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description text;
