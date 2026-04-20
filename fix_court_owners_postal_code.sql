-- ============================================================
-- Fix: Agregar columnas faltantes a las tablas de canchas
-- Ejecutar en Supabase SQL Editor si las tablas ya fueron creadas
-- ============================================================

-- 1. Agregar la columna postal_code que faltaba en court_owners
ALTER TABLE court_owners ADD COLUMN IF NOT EXISTS postal_code text;

-- 2. Agregar la columna slot_duration (duración del turno) en courts
ALTER TABLE courts ADD COLUMN IF NOT EXISTS slot_duration int NOT NULL DEFAULT 60;

-- 3. Agregar política INSERT para court_owners (faltaba en la migración original)
-- Nota: el registro usa el service role (admin), que bypasea RLS,
-- pero es buena práctica tenerla para otros flujos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'court_owners_insert_own' AND tablename = 'court_owners'
  ) THEN
    CREATE POLICY "court_owners_insert_own" ON court_owners
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END
$$;
