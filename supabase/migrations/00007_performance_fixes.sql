-- =============================================================================
-- 00007_performance_fixes.sql
-- Performance improvements: sync role to JWT app_metadata + missing indexes
-- =============================================================================

-- 1. Función que sincroniza el rol del perfil a auth.users.raw_app_meta_data
--    Esto permite leer el rol desde el JWT sin consultar la tabla profiles.
CREATE OR REPLACE FUNCTION public.sync_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Trigger: se dispara al INSERT o UPDATE del rol en profiles
DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_app_metadata();

-- 2. Backfill: sincronizar roles existentes al app_metadata de auth.users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', r.role)
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 3. Índice faltante para consultas centradas en paciente (clinical_records)
CREATE INDEX IF NOT EXISTS idx_clinical_records_patient_id
  ON public.clinical_records(patient_id);

-- 4. Índice para session_notes por paciente (mismo patrón)
CREATE INDEX IF NOT EXISTS idx_session_notes_patient_id
  ON public.session_notes(patient_id);

-- 5. Índice para appointments por status (usado en métricas y filtros)
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON public.appointments(status);
