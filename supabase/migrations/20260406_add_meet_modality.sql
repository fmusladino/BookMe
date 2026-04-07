-- Agregar default_meet_url al profesional (link fijo de Google Meet)
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS default_meet_url TEXT DEFAULT NULL;

-- Agregar modalidad a servicios (presencial, virtual o ambos)
ALTER TABLE services ADD COLUMN IF NOT EXISTS modality TEXT DEFAULT 'presencial' CHECK (modality IN ('presencial', 'virtual', 'both'));

-- Agregar modalidad y meet_url a turnos
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS modality TEXT DEFAULT 'presencial' CHECK (modality IN ('presencial', 'virtual'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_url TEXT DEFAULT NULL;
