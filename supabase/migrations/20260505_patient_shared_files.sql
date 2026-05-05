-- ============================================================
-- Archivos compartidos por el paciente con su profesional
-- El paciente sube estudios desde su portal y los envía a uno
-- de sus profesionales. El profesional los ve en las notas
-- del paciente.
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_shared_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id     uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  file_name           text NOT NULL,
  file_path           text NOT NULL,
  file_size           integer NOT NULL,
  mime_type           text NOT NULL,
  description         text,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  viewed_at           timestamptz
);

CREATE INDEX idx_patient_shared_files_professional
  ON patient_shared_files(professional_id, patient_id, uploaded_at DESC);

CREATE INDEX idx_patient_shared_files_patient
  ON patient_shared_files(patient_profile_id, uploaded_at DESC);

-- Bucket privado para los archivos del paciente
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-shared-files', 'patient-shared-files', false)
ON CONFLICT (id) DO NOTHING;

-- El paciente sube archivos solo en su propia carpeta
CREATE POLICY "Patient can upload own shared files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'patient-shared-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- El paciente puede leer y borrar lo que él mismo subió
CREATE POLICY "Patient can read own shared files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'patient-shared-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Patient can delete own shared files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'patient-shared-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS sobre la tabla
ALTER TABLE patient_shared_files ENABLE ROW LEVEL SECURITY;

-- El paciente ve y administra los archivos que subió él mismo
CREATE POLICY "Patient owns shared files"
ON patient_shared_files FOR ALL
USING (patient_profile_id = auth.uid())
WITH CHECK (patient_profile_id = auth.uid());

-- El profesional ve los archivos que le enviaron
CREATE POLICY "Professional can read shared files sent to them"
ON patient_shared_files FOR SELECT
USING (professional_id = auth.uid());

-- El profesional puede actualizar viewed_at cuando los abre
CREATE POLICY "Professional can mark shared files as viewed"
ON patient_shared_files FOR UPDATE
USING (professional_id = auth.uid())
WITH CHECK (professional_id = auth.uid());
