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
