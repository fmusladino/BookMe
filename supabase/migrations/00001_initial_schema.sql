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
