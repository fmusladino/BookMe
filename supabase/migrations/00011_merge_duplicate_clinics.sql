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
