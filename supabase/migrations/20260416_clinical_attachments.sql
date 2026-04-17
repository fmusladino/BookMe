-- Tabla para archivos adjuntos de historia clínica
CREATE TABLE IF NOT EXISTS clinical_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,        -- ruta en Supabase Storage
  file_size INTEGER NOT NULL,     -- tamaño en bytes
  mime_type TEXT NOT NULL,         -- image/jpeg, image/png, application/pdf
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsqueda eficiente
CREATE INDEX idx_clinical_attachments_record ON clinical_attachments(record_id);
CREATE INDEX idx_clinical_attachments_professional ON clinical_attachments(professional_id, patient_id);

-- Inmutabilidad: no se pueden eliminar archivos adjuntos (misma política que HC)
CREATE OR REPLACE FUNCTION prevent_clinical_attachment_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los archivos adjuntos de historia clínica no pueden eliminarse (Ley 26.529)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_clinical_attachment_delete
BEFORE DELETE ON clinical_attachments
FOR EACH ROW EXECUTE FUNCTION prevent_clinical_attachment_delete();

-- Storage bucket privado para archivos clínicos
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-attachments', 'clinical-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para storage: solo el profesional propietario puede acceder
CREATE POLICY "Professional can upload clinical attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'clinical-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Professional can read own clinical attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'clinical-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
