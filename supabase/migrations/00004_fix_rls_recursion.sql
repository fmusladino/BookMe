-- ============================================================
-- BookMe — Fix: recursión infinita en políticas RLS
-- El problema: las policies de appointments, professionals y
-- clinic_admins se referencian mutuamente creando un loop.
-- Solución: usar funciones SECURITY DEFINER que bypasean RLS
-- en las tablas internas de la consulta.
-- ============================================================

-- ─── Helper: ¿el usuario es admin de un consultorio dado? ───
CREATE OR REPLACE FUNCTION is_clinic_admin_of(p_clinic_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM clinic_admins
    WHERE clinic_id = p_clinic_id AND profile_id = auth.uid()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Helper: ¿el usuario es dueño de un consultorio dado? ───
CREATE OR REPLACE FUNCTION is_clinic_owner(p_clinic_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM clinics
    WHERE id = p_clinic_id AND owner_id = auth.uid()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Helper: obtener clinic_id de un profesional ────────────
CREATE OR REPLACE FUNCTION get_professional_clinic_id(p_professional_id uuid)
RETURNS uuid AS $$
  SELECT clinic_id FROM professionals WHERE id = p_professional_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Eliminar políticas problemáticas ───────────────────────

-- clinic_admins
DROP POLICY IF EXISTS "Admins de clínica: lectura por dueño" ON clinic_admins;
DROP POLICY IF EXISTS "Admins de clínica: gestión por dueño" ON clinic_admins;

-- professionals
DROP POLICY IF EXISTS "Profesionales: vista por admin de clínica" ON professionals;

-- appointments
DROP POLICY IF EXISTS "Turnos: vista por admin de clínica" ON appointments;

-- clinics
DROP POLICY IF EXISTS "Clínica: lectura por miembro" ON clinics;
DROP POLICY IF EXISTS "Clínica: gestión por dueño" ON clinics;

-- ─── Recrear políticas sin recursión ────────────────────────

-- clinic_admins: lectura
CREATE POLICY "Admins de clínica: lectura por dueño" ON clinic_admins
  FOR SELECT USING (
    is_clinic_owner(clinic_id)
    OR profile_id = auth.uid()
    OR is_superadmin()
  );

-- clinic_admins: gestión
CREATE POLICY "Admins de clínica: gestión por dueño" ON clinic_admins
  FOR ALL USING (
    is_clinic_owner(clinic_id)
    OR is_superadmin()
  );

-- clinics: lectura
CREATE POLICY "Clínica: lectura por miembro" ON clinics
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_clinic_admin_of(id)
    OR is_superadmin()
  );

-- clinics: gestión
CREATE POLICY "Clínica: gestión por dueño" ON clinics
  FOR ALL USING (owner_id = auth.uid() OR is_superadmin());

-- professionals: vista por admin de clínica
CREATE POLICY "Profesionales: vista por admin de clínica" ON professionals
  FOR SELECT USING (
    clinic_id IS NOT NULL
    AND is_clinic_admin_of(clinic_id)
  );

-- appointments: vista por admin de clínica
CREATE POLICY "Turnos: vista por admin de clínica" ON appointments
  FOR SELECT USING (
    is_clinic_admin_of(get_professional_clinic_id(professional_id))
  );
