-- Migración 00014: Campos de auditoría para publicación en cartilla (directorio público)
-- El campo is_visible ya existe en professionals. Agregamos campos de control admin.

ALTER TABLE professionals
  ADD COLUMN directory_approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN directory_approved_at timestamptz,
  ADD COLUMN directory_hidden_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN directory_hidden_at   timestamptz;

-- Comentarios descriptivos
COMMENT ON COLUMN professionals.is_visible IS 'Controla si el profesional aparece en la cartilla (directorio público). Puede ser cambiado por el profesional o forzado por un superadmin.';
COMMENT ON COLUMN professionals.directory_approved_by IS 'UUID del superadmin que aprobó la publicación en cartilla (NULL si fue el profesional).';
COMMENT ON COLUMN professionals.directory_approved_at IS 'Fecha de aprobación/publicación en cartilla por un superadmin.';
COMMENT ON COLUMN professionals.directory_hidden_by IS 'UUID del superadmin que ocultó de la cartilla (NULL si fue el profesional).';
COMMENT ON COLUMN professionals.directory_hidden_at IS 'Fecha en que se ocultó de la cartilla por un superadmin.';
