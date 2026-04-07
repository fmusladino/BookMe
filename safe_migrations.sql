-- ============================================================
-- BookMe — Migración segura (idempotente)
-- Primero limpia todo y luego recrea
-- ============================================================

-- Eliminar todas las tablas existentes en orden (respetando foreign keys)
DROP TABLE IF EXISTS clinic_plan_prices CASCADE;
DROP TABLE IF EXISTS clinic_plans CASCADE;
DROP TABLE IF EXISTS directory_listing_audit CASCADE;
DROP TABLE IF EXISTS staff_roles CASCADE;
DROP TABLE IF EXISTS clinic_branches CASCADE;
DROP TABLE IF EXISTS google_calendar_connections CASCADE;
DROP TABLE IF EXISTS trial_email_log CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS billing_items CASCADE;
DROP TABLE IF EXISTS session_notes CASCADE;
DROP TABLE IF EXISTS clinical_record_audit CASCADE;
DROP TABLE IF EXISTS clinical_records CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS schedule_blocks CASCADE;
DROP TABLE IF EXISTS working_hours CASCADE;
DROP TABLE IF EXISTS schedule_configs CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS insurances CASCADE;
DROP TABLE IF EXISTS professionals CASCADE;
DROP TABLE IF EXISTS clinic_admins CASCADE;
DROP TABLE IF EXISTS clinics CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Eliminar enums existentes
DROP TYPE IF EXISTS line_of_business CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;
DROP TYPE IF EXISTS subscription_plan CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- ============================================================
-- BookMe — Migración inicial
-- Crea enums, tablas, índices y triggers base
-- ============================================================

-- ─── Enums ──────────────────────────────────────────────────
CREATE TYPE line_of_business AS ENUM ('healthcare', 'business');
CREATE TYPE user_role AS ENUM ('professional', 'patient', 'admin', 'superadmin', 'marketing');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE subscription_plan AS ENUM ('free', 'standard', 'premium');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'read_only', 'cancelled');

-- ─── Extensiones ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  full_name   text NOT NULL,
  dni         text UNIQUE NOT NULL,
  phone       text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: crear perfil vacío al registrarse (rol asignado luego)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- El rol y DNI se completan en el onboarding.
  -- Solo insertamos si el metadata ya trae el rol.
  IF (NEW.raw_user_meta_data->>'role') IS NOT NULL THEN
    INSERT INTO profiles (id, role, full_name, dni)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'role')::user_role,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'dni', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── clinics ─────────────────────────────────────────────────
CREATE TABLE clinics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE,
  owner_id   uuid NOT NULL REFERENCES profiles(id),
  address    text,
  city       text,
  province   text,
  country    text NOT NULL DEFAULT 'AR',
  phone      text,
  email      text,
  logo_url   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── clinic_admins ───────────────────────────────────────────
CREATE TABLE clinic_admins (
  clinic_id  uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (clinic_id, profile_id)
);

-- ─── professionals ───────────────────────────────────────────
CREATE TABLE professionals (
  id                  uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id           uuid REFERENCES clinics(id),
  line                line_of_business NOT NULL,
  specialty           text NOT NULL,
  specialty_slug      text NOT NULL,
  bio                 text,
  city                text NOT NULL,
  province            text NOT NULL,
  country             text NOT NULL DEFAULT 'AR',
  address             text,
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  public_slug         text UNIQUE NOT NULL,
  is_visible          boolean NOT NULL DEFAULT true,
  subscription_plan   subscription_plan NOT NULL DEFAULT 'free',
  subscription_status subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at       timestamptz,
  mp_subscription_id  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_professionals_city_specialty ON professionals(city, specialty_slug) WHERE is_visible = true;
CREATE INDEX idx_professionals_location ON professionals USING gist(point(longitude, latitude)) WHERE is_visible = true;

-- ─── insurances ──────────────────────────────────────────────
CREATE TABLE insurances (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  code      text UNIQUE,
  logo_url  text,
  is_active boolean NOT NULL DEFAULT true
);

-- ─── patients ────────────────────────────────────────────────
CREATE TABLE patients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       uuid REFERENCES profiles(id),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  dni              text NOT NULL,
  full_name        text NOT NULL,
  email            text,
  phone            text,
  birth_date       date,
  insurance_id     uuid REFERENCES insurances(id),
  insurance_number text,
  is_particular    boolean NOT NULL DEFAULT false,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(professional_id, dni)
);

CREATE INDEX idx_patients_professional ON patients(professional_id);

-- ─── services ────────────────────────────────────────────────
CREATE TABLE services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  name             text NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  price            numeric(10,2),
  show_price       boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  line             line_of_business NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── schedule_configs ────────────────────────────────────────
CREATE TABLE schedule_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id   uuid UNIQUE NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  working_days      int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  slot_duration     int NOT NULL DEFAULT 30,
  lunch_break_start time,
  lunch_break_end   time,
  vacation_mode     boolean NOT NULL DEFAULT false,
  vacation_until    date,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── working_hours ───────────────────────────────────────────
CREATE TABLE working_hours (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week      int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       time NOT NULL,
  end_time         time NOT NULL
);

-- ─── schedule_blocks ─────────────────────────────────────────
CREATE TABLE schedule_blocks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  reason           text
);

-- ─── appointments ────────────────────────────────────────────
CREATE TABLE appointments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id      uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id           uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service_id           uuid REFERENCES services(id),
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz NOT NULL,
  status               appointment_status NOT NULL DEFAULT 'pending',
  booked_by            uuid REFERENCES profiles(id),
  notes                text,
  reminder_sent        boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  cancelled_at         timestamptz,
  cancellation_reason  text
);

CREATE INDEX idx_appointments_professional_date ON appointments(professional_id, starts_at);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_reminder ON appointments(starts_at, reminder_sent) WHERE status IN ('confirmed', 'pending');

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── clinical_records ────────────────────────────────────────
-- content_encrypted: AES-256-GCM en base64. NUNCA texto plano.
CREATE TABLE clinical_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id     uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id      uuid UNIQUE REFERENCES appointments(id),
  content_encrypted   bytea NOT NULL,
  iv                  bytea NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_records_patient ON clinical_records(professional_id, patient_id);

CREATE TRIGGER clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── clinical_record_audit ───────────────────────────────────
CREATE TABLE clinical_record_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    uuid NOT NULL REFERENCES clinical_records(id) ON DELETE CASCADE,
  accessed_by  uuid NOT NULL REFERENCES profiles(id),
  action       text NOT NULL CHECK (action IN ('read', 'create', 'update')),
  accessed_at  timestamptz NOT NULL DEFAULT now(),
  ip_address   inet
);

CREATE INDEX idx_audit_record ON clinical_record_audit(record_id, accessed_at DESC);

-- ─── session_notes ───────────────────────────────────────────
CREATE TABLE session_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id   uuid UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  content          text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER session_notes_updated_at
  BEFORE UPDATE ON session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── billing_items ───────────────────────────────────────────
CREATE TABLE billing_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id  uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id   uuid UNIQUE NOT NULL REFERENCES appointments(id),
  insurance_id     uuid NOT NULL REFERENCES insurances(id),
  practice_code    text NOT NULL,
  practice_name    text NOT NULL,
  amount           numeric(10,2) NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid')),
  period_month     int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      int NOT NULL,
  facturante_ref   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── coupons ─────────────────────────────────────────────────
CREATE TABLE coupons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  discount_pct int NOT NULL CHECK (discount_pct BETWEEN 0 AND 100),
  max_uses     int,
  used_count   int NOT NULL DEFAULT 0,
  valid_until  date,
  created_by   uuid NOT NULL REFERENCES profiles(id),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
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
-- ============================================================
-- BookMe — Migración: actualización de planes de suscripción
-- Agrega tier 'base', billing cycle, suscripciones de consultorio,
-- datos de retención y campos de cancelación
-- ============================================================

-- ─── Actualizar enum subscription_plan ───────────────────────
-- Renombrar 'free' a 'base' no es posible en PostgreSQL.
-- Agregamos 'base' y dejamos 'free' como estado sin plan activo.
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'base' AFTER 'free';

-- ─── Enum para ciclo de facturación ─────────────────────────
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');

-- ─── Nuevos campos en professionals ─────────────────────────
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_retention_until timestamptz,
  ADD COLUMN IF NOT EXISTS mp_plan_id text;

-- Comentarios para documentar la lógica de negocio
COMMENT ON COLUMN professionals.billing_cycle IS 'monthly o annual — afecta el descuento (20% anual)';
COMMENT ON COLUMN professionals.subscription_expires_at IS 'Fecha de expiración del período actual';
COMMENT ON COLUMN professionals.cancelled_at IS 'Fecha en que el profesional canceló su cuenta';
COMMENT ON COLUMN professionals.data_retention_until IS 'Fecha límite de retención de datos (90 días post-cancelación)';
COMMENT ON COLUMN professionals.mp_plan_id IS 'ID del plan en MercadoPago para distinguir base/standard/premium';

-- ─── Tabla: suscripciones de consultorio ─────────────────────
CREATE TABLE clinic_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid UNIQUE NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan                text NOT NULL CHECK (plan IN ('small', 'large')),
  billing_cycle       billing_cycle NOT NULL DEFAULT 'monthly',
  status              subscription_status NOT NULL DEFAULT 'trialing',
  max_professionals   int NOT NULL DEFAULT 10,
  price_usd           numeric(10,2) NOT NULL,
  trial_ends_at       timestamptz,
  subscription_expires_at timestamptz,
  mp_subscription_id  text,
  mp_plan_id          text,
  cancelled_at        timestamptz,
  data_retention_until timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinic_subscriptions IS 'Suscripciones de consultorios — solo Healthcare';
COMMENT ON COLUMN clinic_subscriptions.plan IS 'small = hasta 10 profes (USD 79), large = 11+ profes (USD 149)';

CREATE TRIGGER clinic_subscriptions_updated_at
  BEFORE UPDATE ON clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS para clinic_subscriptions ───────────────────────────
ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suscripción clínica: lectura por dueño y admins" ON clinic_subscriptions
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid()
    )
    OR EXISTS(
      SELECT 1 FROM clinic_admins WHERE clinic_id = clinic_subscriptions.clinic_id AND profile_id = auth.uid()
    )
    OR is_superadmin()
  );

CREATE POLICY "Suscripción clínica: gestión por dueño" ON clinic_subscriptions
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid()
    )
    OR is_superadmin()
  );

-- ─── Tabla: precios de planes (referencia, no facturación) ───
CREATE TABLE plan_prices (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line  line_of_business NOT NULL,
  plan  subscription_plan NOT NULL,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  price_usd numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(line, plan, billing_cycle)
);

COMMENT ON TABLE plan_prices IS 'Tabla de referencia con precios vigentes por línea/plan/ciclo';

-- Insertar precios vigentes
INSERT INTO plan_prices (line, plan, billing_cycle, price_usd) VALUES
  -- Healthcare mensual
  ('healthcare', 'base',     'monthly', 9.00),
  ('healthcare', 'standard', 'monthly', 15.00),
  ('healthcare', 'premium',  'monthly', 20.00),
  -- Healthcare anual (20% descuento)
  ('healthcare', 'base',     'annual', 7.20),
  ('healthcare', 'standard', 'annual', 12.00),
  ('healthcare', 'premium',  'annual', 16.00),
  -- Business mensual
  ('business', 'base',     'monthly', 7.00),
  ('business', 'standard', 'monthly', 14.00),
  ('business', 'premium',  'monthly', 25.00),
  -- Business anual (20% descuento)
  ('business', 'base',     'annual', 5.60),
  ('business', 'standard', 'annual', 11.20),
  ('business', 'premium',  'annual', 20.00);

-- plan_prices: lectura pública, escritura solo superadmin
ALTER TABLE plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Precios: lectura pública" ON plan_prices
  FOR SELECT USING (true);

CREATE POLICY "Precios: gestión superadmin" ON plan_prices
  FOR ALL USING (is_superadmin());
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

-- Tabla para suscripciones push de profesionales (Standard+)
-- Permite enviar notificaciones push cuando un paciente reserva un turno

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice para buscar suscripciones por usuario
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS: cada usuario solo puede ver y gestionar sus propias suscripciones
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);-- Agrega campo para trackear qué emails de trial ya se enviaron
-- Formato: CSV de hitos ("7d,3d,0d,expired")
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS trial_email_sent text DEFAULT '';
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
-- =============================================================================
-- 00008_google_calendar_sync.sql
-- Tablas y columnas para sync bidireccional con Google Calendar
-- =============================================================================

-- 1. Tabla para guardar la conexión OAuth del profesional con Google Calendar
CREATE TABLE google_calendar_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id   uuid NOT NULL UNIQUE REFERENCES professionals(id) ON DELETE CASCADE,
  -- Tokens OAuth2 (encriptados en la app, almacenados como texto)
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  token_expires_at  timestamptz NOT NULL,
  -- ID del calendario seleccionado (default: "primary")
  calendar_id       text NOT NULL DEFAULT 'primary',
  -- Sync token de Google para incremental sync (Events.list)
  sync_token        text,
  -- Channel ID para push notifications (webhook)
  channel_id        text,
  channel_expiration timestamptz,
  -- Estado de la conexión
  is_active         boolean NOT NULL DEFAULT true,
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at automático
CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índice para buscar por channel_id (webhook lookup)
CREATE INDEX idx_gcal_connections_channel_id
  ON google_calendar_connections(channel_id)
  WHERE channel_id IS NOT NULL;

-- 2. Agregar google_event_id a appointments para vincular turno ↔ evento GCal
ALTER TABLE appointments
  ADD COLUMN google_event_id text;

-- Índice para buscar appointments por google_event_id (webhook processing)
CREATE INDEX idx_appointments_google_event_id
  ON appointments(google_event_id)
  WHERE google_event_id IS NOT NULL;

-- 3. Agregar google_event_id a schedule_blocks para vincular bloqueos ↔ eventos GCal
ALTER TABLE schedule_blocks
  ADD COLUMN google_event_id text;

CREATE INDEX idx_schedule_blocks_google_event_id
  ON schedule_blocks(google_event_id)
  WHERE google_event_id IS NOT NULL;

-- 4. RLS para google_calendar_connections
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- El profesional solo puede ver/editar su propia conexión
CREATE POLICY gcal_connections_select ON google_calendar_connections
  FOR SELECT USING (professional_id = auth.uid());

CREATE POLICY gcal_connections_insert ON google_calendar_connections
  FOR INSERT WITH CHECK (professional_id = auth.uid());

CREATE POLICY gcal_connections_update ON google_calendar_connections
  FOR UPDATE USING (professional_id = auth.uid());

CREATE POLICY gcal_connections_delete ON google_calendar_connections
  FOR DELETE USING (professional_id = auth.uid());
-- ============================================================================
-- Migración 00009: Inmutabilidad de Historia Clínica + Log de Auditoría mejorado
-- ============================================================================
-- Cumplimiento: Ley 26.529 (Derechos del Paciente, Argentina)
-- Principio: Las entradas de HC son INMUTABLES una vez creadas.
--   - No se pueden eliminar.
--   - No se puede sobrescribir el contenido original.
--   - Solo se pueden agregar ENMIENDAS (amendment) que referencian la entrada original.
--   - El audit log es append-only e indestructible.
-- ============================================================================

-- ─── 1. Ampliar acciones del audit log ──────────────────────────────────────
-- Agregar 'delete', 'export', 'amendment' como acciones válidas
ALTER TABLE clinical_record_audit
  DROP CONSTRAINT IF EXISTS clinical_record_audit_action_check;

ALTER TABLE clinical_record_audit
  ADD CONSTRAINT clinical_record_audit_action_check
  CHECK (action IN ('read', 'create', 'update', 'delete', 'export', 'amendment'));

-- ─── 2. Agregar campo de detalle al audit log ──────────────────────────────
-- Para registrar metadata adicional (ej: motivo de enmienda, qué se intentó)
ALTER TABLE clinical_record_audit
  ADD COLUMN IF NOT EXISTS details jsonb DEFAULT NULL;

-- ─── 3. Desacoplar audit de la FK con CASCADE ──────────────────────────────
-- El CASCADE actual destruye los logs de auditoría cuando se borra un registro.
-- Cambiamos a SET NULL para preservar el trail incluso si el registro desaparece.
ALTER TABLE clinical_record_audit
  DROP CONSTRAINT IF EXISTS clinical_record_audit_record_id_fkey;

ALTER TABLE clinical_record_audit
  ALTER COLUMN record_id DROP NOT NULL;

ALTER TABLE clinical_record_audit
  ADD CONSTRAINT clinical_record_audit_record_id_fkey
  FOREIGN KEY (record_id) REFERENCES clinical_records(id) ON DELETE SET NULL;

-- ─── 4. Columnas de inmutabilidad en clinical_records ──────────────────────
-- is_amendment: marca que esta entrada es una enmienda de otra
-- amends_record_id: referencia a la entrada original que se enmienda
-- is_archived: soft-delete (el profesional puede "archivar" pero nunca borrar)
ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS is_amendment boolean NOT NULL DEFAULT false;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS amends_record_id uuid DEFAULT NULL
  REFERENCES clinical_records(id) ON DELETE SET NULL;

ALTER TABLE clinical_records
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Índice para buscar enmiendas de un registro
CREATE INDEX IF NOT EXISTS idx_clinical_records_amends
  ON clinical_records(amends_record_id)
  WHERE amends_record_id IS NOT NULL;

-- ─── 5. Trigger: bloquear DELETE en clinical_records ────────────────────────
-- Ningún usuario ni proceso puede eliminar una entrada de HC.
CREATE OR REPLACE FUNCTION prevent_clinical_record_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Las entradas de historia clínica no pueden ser eliminadas (Ley 26.529). Use el archivado en su lugar.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_clinical_record_delete ON clinical_records;
CREATE TRIGGER trg_prevent_clinical_record_delete
  BEFORE DELETE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION prevent_clinical_record_delete();

-- ─── 6. Trigger: bloquear UPDATE del contenido encriptado ───────────────────
-- Solo se permite actualizar is_archived (soft delete).
-- El contenido encriptado, iv, patient_id, professional_id son INMUTABLES.
CREATE OR REPLACE FUNCTION enforce_clinical_record_immutability()
RETURNS trigger AS $$
BEGIN
  -- Permitir cambio de is_archived (archivado/desarchivado)
  IF OLD.content_encrypted = NEW.content_encrypted
     AND OLD.iv = NEW.iv
     AND OLD.patient_id = NEW.patient_id
     AND OLD.professional_id = NEW.professional_id
     AND OLD.appointment_id IS NOT DISTINCT FROM NEW.appointment_id
     AND OLD.is_amendment = NEW.is_amendment
     AND OLD.amends_record_id IS NOT DISTINCT FROM NEW.amends_record_id
  THEN
    -- Solo cambió is_archived u updated_at → permitido
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'El contenido de la historia clínica es inmutable (Ley 26.529). Cree una enmienda en su lugar.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_clinical_record_immutability ON clinical_records;
CREATE TRIGGER trg_enforce_clinical_record_immutability
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION enforce_clinical_record_immutability();

-- ─── 7. Trigger: hacer audit log verdaderamente inmutable ───────────────────
-- Bloquear UPDATE y DELETE en clinical_record_audit
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoría son inmutables y no pueden ser modificados ni eliminados.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON clinical_record_audit;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON clinical_record_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON clinical_record_audit;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON clinical_record_audit
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- ─── 8. RLS: permitir al paciente leer audit de su propia HC ────────────────
-- (Para transparencia — el paciente puede ver quién accedió a su HC)
CREATE POLICY "Auditoría HC: lectura por paciente"
  ON clinical_record_audit
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM clinical_records cr
      JOIN patients p ON p.id = cr.patient_id
      WHERE cr.id = record_id AND p.profile_id = auth.uid()
    )
  );

-- ─── 9. Índice para consultas de audit por usuario ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_accessed_by
  ON clinical_record_audit(accessed_by, accessed_at DESC);
-- ============================================================
-- BookMe — Sedes de consultorio (clinic_branches)
-- Una clínica puede tener múltiples sedes con distintas
-- direcciones. Cada profesional se asigna a una sede.
-- ============================================================

-- ─── 1. Tabla clinic_branches ──────────────────────────────────
CREATE TABLE clinic_branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name        text,                          -- nombre opcional de la sede (ej: "Sede Belgrano")
  address     text NOT NULL,
  city        text NOT NULL,
  province    text NOT NULL,
  country     text NOT NULL DEFAULT 'AR',
  phone       text,
  email       text,
  latitude    numeric(10,7),
  longitude   numeric(10,7),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_branches_clinic ON clinic_branches(clinic_id);

-- ─── 2. RLS ────────────────────────────────────────────────────
ALTER TABLE clinic_branches ENABLE ROW LEVEL SECURITY;

-- Lectura: dueño de la clínica, admin de la clínica, o superadmin
CREATE POLICY "Sedes: lectura por miembro" ON clinic_branches
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid())
    OR is_clinic_admin_of(clinic_id)
    OR is_superadmin()
  );

-- Gestión: dueño o superadmin
CREATE POLICY "Sedes: gestión por dueño" ON clinic_branches
  FOR ALL USING (
    EXISTS(SELECT 1 FROM clinics WHERE id = clinic_id AND owner_id = auth.uid())
    OR is_superadmin()
  );

-- ─── 3. Agregar branch_id a professionals ──────────────────────
ALTER TABLE professionals
  ADD COLUMN branch_id uuid REFERENCES clinic_branches(id) ON DELETE SET NULL;

CREATE INDEX idx_professionals_branch ON professionals(branch_id) WHERE branch_id IS NOT NULL;

-- ─── 4. Migrar datos existentes ────────────────────────────────
-- Para cada clínica que ya tiene dirección, crear una sede por defecto
-- y asignar sus profesionales a esa sede
DO $$
DECLARE
  r RECORD;
  new_branch_id uuid;
BEGIN
  FOR r IN
    SELECT id, name, address, city, province, country, phone, email
    FROM clinics
    WHERE address IS NOT NULL
  LOOP
    INSERT INTO clinic_branches (clinic_id, name, address, city, province, country, phone, email)
    VALUES (r.id, 'Sede principal', r.address, COALESCE(r.city, ''), COALESCE(r.province, ''), COALESCE(r.country, 'AR'), r.phone, r.email)
    RETURNING id INTO new_branch_id;

    -- Asignar profesionales de esta clínica a la nueva sede
    UPDATE professionals
    SET branch_id = new_branch_id
    WHERE clinic_id = r.id AND branch_id IS NULL;
  END LOOP;
END $$;

COMMENT ON TABLE clinic_branches IS 'Sedes/sucursales de un consultorio. Cada sede tiene su propia dirección y profesionales.';
COMMENT ON COLUMN clinic_branches.name IS 'Nombre opcional de la sede (ej: Sede Belgrano, Sede Centro)';
COMMENT ON COLUMN professionals.branch_id IS 'Sede del consultorio donde atiende este profesional';
-- =====================================================
-- Migración: Unificar clínicas duplicadas
-- Mantiene la primera clínica creada y mueve las sedes
-- de la segunda a la primera.
-- =====================================================

DO $$
DECLARE
  v_keep_id uuid;
  v_remove_id uuid;
  v_count int;
BEGIN
  -- Identificar las dos clínicas con el mismo nombre
  -- Nos quedamos con la primera creada (created_at más viejo)
  SELECT id INTO v_keep_id
  FROM clinics
  WHERE name = 'Centro Médico Salud Total'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_remove_id
  FROM clinics
  WHERE name = 'Centro Médico Salud Total'
    AND id != v_keep_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si no hay duplicada, no hacer nada
  IF v_remove_id IS NULL THEN
    RAISE NOTICE 'No se encontró clínica duplicada. Nada que hacer.';
    RETURN;
  END IF;

  RAISE NOTICE 'Conservando clínica: %', v_keep_id;
  RAISE NOTICE 'Eliminando clínica: %', v_remove_id;

  -- 1. Mover sedes de la clínica duplicada a la principal
  UPDATE clinic_branches
  SET clinic_id = v_keep_id
  WHERE clinic_id = v_remove_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Sedes movidas: %', v_count;

  -- 2. Mover profesionales que apunten a la clínica duplicada
  UPDATE professionals
  SET clinic_id = v_keep_id
  WHERE clinic_id = v_remove_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profesionales movidos: %', v_count;

  -- 3. Mover registros de clinic_admins (evitar duplicados)
  INSERT INTO clinic_admins (clinic_id, profile_id)
  SELECT v_keep_id, profile_id
  FROM clinic_admins
  WHERE clinic_id = v_remove_id
    AND profile_id NOT IN (
      SELECT profile_id FROM clinic_admins WHERE clinic_id = v_keep_id
    );

  -- Eliminar los registros de admin de la clínica duplicada
  DELETE FROM clinic_admins WHERE clinic_id = v_remove_id;

  -- 4. Eliminar la clínica duplicada
  DELETE FROM clinics WHERE id = v_remove_id;

  RAISE NOTICE 'Clínica duplicada eliminada exitosamente.';
END $$;
-- =====================================================
-- Migración: Asignar profesionales sin clinic_id
-- a la clínica existente.
-- =====================================================

DO $$
DECLARE
  v_clinic_id uuid;
  v_count int;
BEGIN
  -- Obtener la clínica principal (la primera creada)
  SELECT id INTO v_clinic_id
  FROM clinics
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RAISE NOTICE 'No hay clínicas. Nada que hacer.';
    RETURN;
  END IF;

  RAISE NOTICE 'Clínica principal: %', v_clinic_id;

  -- Asignar los profesionales sin clinic_id a esta clínica
  UPDATE professionals
  SET clinic_id = v_clinic_id
  WHERE clinic_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profesionales asignados a la clínica: %', v_count;

  -- También asignar branch_id de la sede principal si no tienen branch
  UPDATE professionals p
  SET branch_id = (
    SELECT id FROM clinic_branches
    WHERE clinic_id = v_clinic_id
    ORDER BY created_at ASC
    LIMIT 1
  )
  WHERE p.clinic_id = v_clinic_id
    AND p.branch_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Profesionales asignados a sede central: %', v_count;
END $$;
-- ============================================================
-- BookMe — Migración 00013: Roles de staff y auditoría de admins
-- Agrega roles diferenciados para admins de clínica y log de auditoría
-- ============================================================

-- ─── Enum para roles de staff dentro de la clínica ──────────
CREATE TYPE clinic_staff_role AS ENUM (
  'secretaria',
  'recepcionista',
  'gerente',
  'contador',
  'otro'
);

-- ─── Agregar columnas a clinic_admins ───────────────────────
ALTER TABLE clinic_admins
  ADD COLUMN staff_role clinic_staff_role NOT NULL DEFAULT 'secretaria',
  ADD COLUMN label      text,                -- etiqueta personalizada si staff_role = 'otro'
  ADD COLUMN is_active  boolean NOT NULL DEFAULT true,
  ADD COLUMN added_by   uuid REFERENCES profiles(id),
  ADD COLUMN added_at   timestamptz NOT NULL DEFAULT now();

-- ─── Tabla de auditoría de acciones sobre admins ────────────
CREATE TABLE clinic_admin_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL REFERENCES profiles(id),
  performed_by uuid NOT NULL REFERENCES profiles(id),
  action      text NOT NULL CHECK (action IN ('added', 'removed', 'role_changed', 'deactivated', 'reactivated')),
  details     jsonb,           -- info extra: { old_role, new_role, reason, ... }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinic_admin_audit_clinic ON clinic_admin_audit(clinic_id, created_at DESC);
CREATE INDEX idx_clinic_admin_audit_target ON clinic_admin_audit(target_id, created_at DESC);

-- ─── RLS para clinic_admin_audit ────────────────────────────
ALTER TABLE clinic_admin_audit ENABLE ROW LEVEL SECURITY;

-- Solo owner y admins de la misma clínica pueden ver el log
CREATE POLICY "clinic_admin_audit_select"
  ON clinic_admin_audit FOR SELECT
  USING (
    clinic_id IN (
      SELECT id FROM clinics WHERE owner_id = auth.uid()
      UNION
      SELECT clinic_id FROM clinic_admins WHERE profile_id = auth.uid()
    )
  );

-- Solo owner puede insertar (a través del backend)
CREATE POLICY "clinic_admin_audit_insert"
  ON clinic_admin_audit FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT id FROM clinics WHERE owner_id = auth.uid()
    )
  );
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
-- ============================================================
-- BookMe — Migración: ABM de planes y features configurables
-- Permite gestionar planes, precios y features desde el admin
-- ============================================================

-- ─── Tabla: definición de features disponibles ──────────────
CREATE TABLE IF NOT EXISTS feature_definitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'general',
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE feature_definitions IS 'Catálogo maestro de features configurables del sistema';

CREATE TRIGGER feature_definitions_updated_at
  BEFORE UPDATE ON feature_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Tabla: features asignadas por plan y línea ─────────────
CREATE TABLE IF NOT EXISTS plan_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line        line_of_business NOT NULL,
  plan        subscription_plan NOT NULL,
  feature_id  uuid NOT NULL REFERENCES feature_definitions(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line, plan, feature_id)
);

COMMENT ON TABLE plan_features IS 'Matriz de features habilitadas por línea + plan';

CREATE TRIGGER plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Lectura pública (la app necesita leer features para gating)
CREATE POLICY "Features: lectura pública" ON feature_definitions
  FOR SELECT USING (true);

CREATE POLICY "Plan features: lectura pública" ON plan_features
  FOR SELECT USING (true);

-- Escritura solo superadmin
CREATE POLICY "Features: gestión superadmin" ON feature_definitions
  FOR ALL USING (is_superadmin());

CREATE POLICY "Plan features: gestión superadmin" ON plan_features
  FOR ALL USING (is_superadmin());

-- ─── Seed: features iniciales ───────────────────────────────
INSERT INTO feature_definitions (key, label, description, category, sort_order) VALUES
  ('mia_basic',           'MIA Básica',               'Chat flotante con consultas sobre agenda',                     'mia',          10),
  ('mia_advanced',        'MIA Avanzada',             'Crear/cancelar/bloquear turnos por texto con confirmación',    'mia',          20),
  ('mia_transcription',   'MIA Transcripción HC',     'Transcripción automática para historia clínica (Premium HC)',  'mia',          30),
  ('push_notifications',  'Push Notifications',       'Notificaciones push al celular del profesional',               'notificaciones', 40),
  ('dashboard_financial', 'Dashboard Financiero',     'Ingresos particulares + OS pendiente de cobro',                'metricas',     50),
  ('insurance_billing',   'Liquidación Obra Social',  'Carga de valor por práctica y OS para liquidación',            'facturacion',  60),
  ('afip_billing',        'Facturación AFIP',         'Integración AFIP vía Facturante/Factura.ai',                   'facturacion',  70),
  ('service_catalog',     'Catálogo de Servicios',    'Lista de servicios con precio opcional',                       'servicios',    80),
  ('reports_export',      'Exportar Reportes',        'Exportar métricas y reportes en PDF/Excel',                    'metricas',     90),
  ('multiple_locations',  'Múltiples Sucursales',     'Gestionar agenda en más de una ubicación',                     'agenda',       100),
  ('whatsapp_own_number', 'WhatsApp Propio',          'Enviar recordatorios desde número propio (no BookMe)',         'notificaciones', 110),
  ('qr_custom',           'QR Personalizado',         'Código QR con branding propio para compartir perfil',          'marketing',    120)
ON CONFLICT (key) DO NOTHING;

-- ─── Seed: matriz de features por plan (replica feature-flags.ts) ───
-- Se usa una función para insertar masivamente

DO $$
DECLARE
  feat_id uuid;
  feat_key text;
BEGIN
  -- Healthcare features
  FOR feat_id, feat_key IN SELECT id, key FROM feature_definitions LOOP
    -- Free: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'free', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Base: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'base', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Standard HC
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'standard', feat_id,
      feat_key IN ('mia_basic','mia_advanced','push_notifications','dashboard_financial','insurance_billing','afip_billing','service_catalog','reports_export','qr_custom')
    )
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Premium HC: todo habilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('healthcare', 'premium', feat_id, true)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Business free: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'free', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Business base: todo deshabilitado
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'base', feat_id, false)
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Standard Business
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'standard', feat_id,
      feat_key IN ('mia_basic','mia_advanced','push_notifications','service_catalog','reports_export','qr_custom')
    )
    ON CONFLICT (line, plan, feature_id) DO NOTHING;

    -- Premium Business
    INSERT INTO plan_features (line, plan, feature_id, enabled)
    VALUES ('business', 'premium', feat_id,
      feat_key IN ('mia_basic','mia_advanced','push_notifications','service_catalog','reports_export','multiple_locations','whatsapp_own_number','qr_custom')
    )
    ON CONFLICT (line, plan, feature_id) DO NOTHING;
  END LOOP;
END $$;

-- ─── Tabla: precios de planes de consultorio ────────────────
CREATE TABLE IF NOT EXISTS clinic_plan_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan          text NOT NULL CHECK (plan IN ('small', 'large')),
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  price_usd     numeric(10,2) NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan, billing_cycle)
);

COMMENT ON TABLE clinic_plan_prices IS 'Precios de referencia para planes de consultorio (solo Healthcare)';

CREATE TRIGGER clinic_plan_prices_updated_at
  BEFORE UPDATE ON clinic_plan_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clinic_plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic plan prices: lectura pública" ON clinic_plan_prices
  FOR SELECT USING (true);

CREATE POLICY "Clinic plan prices: gestión superadmin" ON clinic_plan_prices
  FOR ALL USING (is_superadmin());

-- Seed precios de consultorio
INSERT INTO clinic_plan_prices (plan, billing_cycle, price_usd) VALUES
  ('small', 'monthly', 79.00),
  ('small', 'annual', 854.00),
  ('large', 'monthly', 149.00),
  ('large', 'annual', 1610.00)
ON CONFLICT (plan, billing_cycle) DO NOTHING;
