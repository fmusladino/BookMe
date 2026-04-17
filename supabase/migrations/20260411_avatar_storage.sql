-- ============================================================
-- Migración: Bucket de Storage para fotos de perfil (avatars)
-- ============================================================

-- 1. Crear bucket público para avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: cualquier usuario autenticado puede subir su propio avatar
-- La estructura esperada es: avatars/{user_id}/avatar.{ext}
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Política: cualquier usuario autenticado puede actualizar su propio avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Política: cualquier usuario autenticado puede eliminar su propio avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Política: lectura pública (el bucket es público, los avatars son visibles para todos)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 6. Agregar avatar_url a court_owners si no existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'court_owners'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'court_owners' AND column_name = 'avatar_url'
    ) THEN
      ALTER TABLE public.court_owners ADD COLUMN avatar_url text;
    END IF;
  END IF;
END $$;
