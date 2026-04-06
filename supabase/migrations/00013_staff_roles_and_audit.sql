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
