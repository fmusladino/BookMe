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
