
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
  WITH CHECK (auth.uid() = user_id);