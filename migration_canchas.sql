-- ============================================================
-- BookMe — Migración: Plan Canchas
-- Agrega soporte para dueños de canchas deportivas
-- ============================================================

-- 1. Extender el enum user_role con el nuevo valor 'canchas'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'canchas';

-- 2. Tabla court_owners — perfil del dueño de canchas
CREATE TABLE IF NOT EXISTS court_owners (
  id              uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_name   text NOT NULL,
  slug            text UNIQUE NOT NULL,
  address         text,
  city            text NOT NULL DEFAULT '',
  province        text NOT NULL DEFAULT '',
  postal_code     text,
  country         text NOT NULL DEFAULT 'AR',
  phone           text,
  whatsapp        text,
  description     text,
  is_visible      boolean NOT NULL DEFAULT true,
  subscription_plan      text NOT NULL DEFAULT 'standard',
  subscription_status    text NOT NULL DEFAULT 'trialing',
  trial_ends_at          timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER court_owners_updated_at
  BEFORE UPDATE ON court_owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Tabla courts — canchas individuales
CREATE TABLE IF NOT EXISTS courts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES court_owners(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  sport           text NOT NULL DEFAULT 'fútbol',   -- fútbol, pádel, tenis, básquet, etc.
  surface         text,                              -- césped, sintético, cemento, etc.
  players         int,                               -- cantidad de jugadores
  price_per_hour  numeric(10,2) NOT NULL DEFAULT 0,
  slot_duration   int NOT NULL DEFAULT 60,            -- duración del turno en minutos
  seña_required   boolean NOT NULL DEFAULT false,
  seña_amount     numeric(10,2),                     -- monto de seña en ARS
  seña_alias      text,                              -- alias CBU/CVU para el pago de seña
  seña_cbu        text,                              -- CBU opcional
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER courts_updated_at
  BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Tabla court_schedules — horarios disponibles por día para cada cancha
CREATE TABLE IF NOT EXISTS court_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id    uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índice para búsquedas por cancha
CREATE INDEX IF NOT EXISTS idx_court_schedules_court_id ON court_schedules(court_id);

-- 5. Tabla court_bookings — reservas de canchas
CREATE TABLE IF NOT EXISTS court_bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id          uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES court_owners(id),
  customer_name     text NOT NULL,
  customer_phone    text,
  customer_email    text,
  booking_date      date NOT NULL,
  start_time        time NOT NULL,
  end_time          time NOT NULL,
  duration_hours    numeric(4,2),
  total_amount      numeric(10,2),
  seña_amount       numeric(10,2),
  seña_paid         boolean NOT NULL DEFAULT false,
  seña_proof_url    text,              -- URL del comprobante de pago de seña
  seña_proof_notes  text,             -- notas del comprobante
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes             text,
  confirmed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER court_bookings_updated_at
  BEFORE UPDATE ON court_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_court_bookings_court_id    ON court_bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_owner_id    ON court_bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_booking_date ON court_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_court_bookings_status      ON court_bookings(status);

-- ─── RLS Policies ────────────────────────────────────────────
ALTER TABLE court_owners   ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_bookings ENABLE ROW LEVEL SECURITY;

-- court_owners: dueño ve y edita su propio perfil; todos pueden ver perfiles visibles
CREATE POLICY "court_owners_select_public" ON court_owners
  FOR SELECT USING (is_visible = true OR auth.uid() = id);

CREATE POLICY "court_owners_update_own" ON court_owners
  FOR UPDATE USING (auth.uid() = id);

-- courts: dueño ve y edita sus propias canchas; todos pueden ver canchas activas de perfiles visibles
CREATE POLICY "courts_select_public" ON courts
  FOR SELECT USING (
    is_active = true OR
    owner_id IN (SELECT id FROM court_owners WHERE auth.uid() = id)
  );

CREATE POLICY "courts_insert_own" ON courts
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM court_owners WHERE auth.uid() = id)
  );

CREATE POLICY "courts_update_own" ON courts
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM court_owners WHERE auth.uid() = id)
  );

CREATE POLICY "courts_delete_own" ON courts
  FOR DELETE USING (
    owner_id IN (SELECT id FROM court_owners WHERE auth.uid() = id)
  );

-- court_schedules: misma lógica que courts
CREATE POLICY "court_schedules_select" ON court_schedules
  FOR SELECT USING (
    court_id IN (SELECT id FROM courts)
  );

CREATE POLICY "court_schedules_manage_own" ON court_schedules
  FOR ALL USING (
    court_id IN (
      SELECT c.id FROM courts c
      JOIN court_owners co ON co.id = c.owner_id
      WHERE co.id = auth.uid()
    )
  );

-- court_bookings: dueño ve todas sus reservas; cualquiera puede insertar (reservar)
CREATE POLICY "court_bookings_select_owner" ON court_bookings
  FOR SELECT USING (auth.uid() = owner_id OR auth.uid()::text = customer_email);

CREATE POLICY "court_bookings_insert_public" ON court_bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "court_bookings_update_owner" ON court_bookings
  FOR UPDATE USING (auth.uid() = owner_id);
