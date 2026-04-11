-- Agregar código postal a la tabla de profesionales
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS postal_code text DEFAULT NULL;

COMMENT ON COLUMN professionals.postal_code IS 'Código postal del consultorio/local del profesional';
