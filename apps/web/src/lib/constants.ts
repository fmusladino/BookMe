/**
 * Duraciones estándar de turnos/servicios en minutos.
 * Fuente única de verdad: usada tanto en configuración de agenda como en servicios.
 */
export const SLOT_DURATIONS = [15, 20, 30, 45, 60, 90] as const;

export type SlotDuration = (typeof SLOT_DURATIONS)[number];
