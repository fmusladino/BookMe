-- ============================================================
-- BookMe — Row Level Security policies
-- Cada tabla sensible tiene RLS habilitado.
-- ============================================================

-- ─── Habilitar RLS en todas las tablas ───────────────────────
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics               ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_record_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurances            ENABLE ROW LEVEL SECURITY;

-- Helper: rol del usuario autenticado
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: ¿el usuario es superadmin?
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── profiles ────────────────────────────────────────────────
CREATE POLICY "Perfil propio: lectura" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_superadmin());

CREATE POLICY "Perfil propio: actualización" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ─── insurances ──────────────────────────────────────────────
-- Lectura pública, escritura solo superadmin
CREATE POLICY "Obras sociales: lectura pública" ON insurances
  FOR SELECT USING (true);

CREATE POLICY "Obras sociales: gestión superadmin" ON insurances
  FOR ALL USING (is_superadmin());

-- ─── clinics ─────────────────────────────────────────────────
CREATE POLICY "Clínica: lectura por miembro" ON clinics
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS(SELECT 1 FROM clinic_admins WHERE clinic_id = id AND profile_id = auth.uid())
    OR is_superadmin()
  );

CREATE POLICY "Clínica: gestión por dueño" ON clinics
  FOR ALL USING (owner_id = auth.uid() OR is_superadmin());

-- ─── clinic_admins ───────────────────────────────────────────
CREATE POLICY "Admins de clínica: lectura por dueño" ON clinic_admins
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid())
    OR profile_id = auth.uid()
    OR is_superadmin()
  );

CREATE POLICY "Admins de clínica: gestión por dueño" ON clinic_admins
  FOR ALL USING (
    EXISTS(SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid())
    OR is_superadmin()
  );

-- ─── professionals ───────────────────────────────────────────
-- Directorio público: solo perfiles visibles
CREATE POLICY "Profesionales: directorio público" ON professionals
  FOR SELECT USING (is_visible = true);

-- El profesional ve y edita su propio perfil
CREATE POLICY "Profesionales: perfil propio" ON professionals
  FOR ALL USING (id = auth.uid());

-- Admin de consultorio puede ver los profesionales de su clínica
CREATE POLICY "Profesionales: vista por admin de clínica" ON professionals
  FOR SELECT USING (
    clinic_id IS NOT NULL
    AND EXISTS(
      SELECT 1 FROM clinic_admins
      WHERE clinic_id = professionals.clinic_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "Profesionales: superadmin" ON professionals
  FOR ALL USING (is_superadmin());

-- ─── patients ────────────────────────────────────────────────
-- SOLO el profesional propietario. Ni admins ni superadmin.
CREATE POLICY "Pacientes: solo el profesional propietario" ON patients
  FOR ALL USING (professional_id = auth.uid());

-- El propio paciente puede ver sus datos si tiene cuenta
CREATE POLICY "Pacientes: vista propia" ON patients
  FOR SELECT USING (profile_id = auth.uid());

-- ─── services ────────────────────────────────────────────────
CREATE POLICY "Servicios: lectura pública de activos" ON services
  FOR SELECT USING (
    is_active = true
    OR professional_id = auth.uid()
  );

CREATE POLICY "Servicios: gestión por profesional" ON services
  FOR ALL USING (professional_id = auth.uid());

-- ─── schedule_configs, working_hours, schedule_blocks ────────
CREATE POLICY "Config agenda: gestión por profesional" ON schedule_configs
  FOR ALL USING (professional_id = auth.uid());

CREATE POLICY "Horarios: gestión por profesional" ON working_hours
  FOR ALL USING (professional_id = auth.uid());

-- Lectura pública de horarios (para flujo de reserva)
CREATE POLICY "Horarios: lectura pública" ON working_hours
  FOR SELECT USING (true);

CREATE POLICY "Bloqueos: gestión por profesional" ON schedule_blocks
  FOR ALL USING (professional_id = auth.uid());

-- ─── appointments ────────────────────────────────────────────
-- El profesional ve todos sus turnos
CREATE POLICY "Turnos: gestión por profesional" ON appointments
  FOR ALL USING (professional_id = auth.uid());

-- El paciente ve solo sus propios turnos
CREATE POLICY "Turnos: vista por paciente" ON appointments
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM patients WHERE id = patient_id AND profile_id = auth.uid())
  );

-- El paciente puede cancelar sus propios turnos
CREATE POLICY "Turnos: cancelación por paciente" ON appointments
  FOR UPDATE USING (
    EXISTS(SELECT 1 FROM patients WHERE id = patient_id AND profile_id = auth.uid())
  )
  WITH CHECK (status = 'cancelled');

-- Admin de consultorio ve turnos de sus profesionales
CREATE POLICY "Turnos: vista por admin de clínica" ON appointments
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM professionals p
      JOIN clinic_admins ca ON ca.clinic_id = p.clinic_id
      WHERE p.id = appointments.professional_id AND ca.profile_id = auth.uid()
    )
  );

CREATE POLICY "Turnos: superadmin" ON appointments
  FOR ALL USING (is_superadmin());

-- ─── clinical_records ────────────────────────────────────────
-- SOLO el profesional propietario. Sin excepciones. Ni superadmin.
CREATE POLICY "Historia clínica: solo el profesional propietario" ON clinical_records
  FOR ALL USING (professional_id = auth.uid());

-- ─── clinical_record_audit ───────────────────────────────────
-- El profesional ve el log de sus propios registros
CREATE POLICY "Auditoría HC: lectura por profesional" ON clinical_record_audit
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM clinical_records
      WHERE id = record_id AND professional_id = auth.uid()
    )
  );

-- Solo insertar (nunca editar ni borrar logs de auditoría)
CREATE POLICY "Auditoría HC: solo inserción" ON clinical_record_audit
  FOR INSERT WITH CHECK (accessed_by = auth.uid());

-- ─── session_notes ───────────────────────────────────────────
CREATE POLICY "Notas de sesión: solo el profesional propietario" ON session_notes
  FOR ALL USING (professional_id = auth.uid());

-- ─── billing_items ───────────────────────────────────────────
CREATE POLICY "Facturación: gestión por profesional" ON billing_items
  FOR ALL USING (professional_id = auth.uid());

CREATE POLICY "Facturación: superadmin" ON billing_items
  FOR SELECT USING (is_superadmin());

-- ─── coupons ─────────────────────────────────────────────────
-- Superadmin y marketing pueden crear. Marketing NO puede modificar.
CREATE POLICY "Cupones: lectura superadmin y marketing" ON coupons
  FOR SELECT USING (auth_role() IN ('superadmin', 'marketing'));

CREATE POLICY "Cupones: creación superadmin y marketing" ON coupons
  FOR INSERT WITH CHECK (auth_role() IN ('superadmin', 'marketing'));

CREATE POLICY "Cupones: modificación solo superadmin" ON coupons
  FOR UPDATE USING (is_superadmin());

CREATE POLICY "Cupones: eliminación solo superadmin" ON coupons
  FOR DELETE USING (is_superadmin());
