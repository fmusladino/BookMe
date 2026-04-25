// Duración del trial gratuito para nuevos profesionales.
// Fuente única de verdad — cambiar acá si se modifica la política.
export const TRIAL_DAYS = 7;

export function getTrialEndsAt(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}
