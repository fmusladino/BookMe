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
