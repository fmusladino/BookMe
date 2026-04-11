-- Agregar campo vacation_from a schedule_configs
-- Permite definir fecha de inicio de vacaciones (desde/hasta)
ALTER TABLE schedule_configs
  ADD COLUMN IF NOT EXISTS vacation_from date DEFAULT NULL;

-- Comentario
COMMENT ON COLUMN schedule_configs.vacation_from IS 'Fecha de inicio del modo vacaciones (nullable)';
COMMENT ON COLUMN schedule_configs.vacation_until IS 'Fecha de fin del modo vacaciones (nullable)';
