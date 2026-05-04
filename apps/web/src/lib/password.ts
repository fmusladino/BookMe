/**
 * Validación de fuerza de contraseñas para BookMe.
 *
 * Requisitos exigidos:
 *  - Mínimo 10 caracteres
 *  - Al menos 1 letra mayúscula
 *  - Al menos 1 letra minúscula
 *  - Al menos 1 número
 *  - Al menos 1 carácter especial
 *  - No estar en la lista de contraseñas comunes
 */

export const PASSWORD_MIN_LENGTH = 10;

// Lista corta de contraseñas más usadas / triviales (lowercase).
// No es exhaustiva: complementa las reglas de composición, no las reemplaza.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd",
  "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "qwerty1234",
  "iloveyou", "admin1234", "administrator",
  "welcome123", "letmein123", "monkey1234",
  "abc12345", "abcd1234", "asdfghjkl",
  "bookme", "bookme123", "bookme1234",
]);

export interface PasswordRequirements {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
  notCommon: boolean;
}

export interface PasswordStrength {
  /** 0 = inválida, 4 = muy fuerte */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Muy débil" | "Débil" | "Regular" | "Fuerte" | "Muy fuerte";
  requirements: PasswordRequirements;
  /** Cumple todos los requisitos mínimos. */
  valid: boolean;
}

export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(password.toLowerCase()),
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  const requirements = checkPasswordRequirements(password);
  const valid = Object.values(requirements).every(Boolean);

  // Score base = cantidad de requisitos cumplidos (excluyendo notCommon que es eliminatorio)
  const baseChecks = [
    requirements.length,
    requirements.upper,
    requirements.lower,
    requirements.number,
    requirements.special,
  ].filter(Boolean).length;

  // Bonus por longitud extra
  let score = baseChecks;
  if (password.length >= 14) score = Math.min(score + 1, 5);
  if (password.length >= 18) score = Math.min(score + 1, 5);

  // Si falla el filtro de comunes, capar en débil
  if (!requirements.notCommon) score = Math.min(score, 1);

  // Mapear a 0-4
  const finalScore = Math.min(score, 4) as PasswordStrength["score"];

  const labels: Record<number, PasswordStrength["label"]> = {
    0: "Muy débil",
    1: "Muy débil",
    2: "Débil",
    3: "Regular",
    4: "Fuerte",
  };

  return {
    score: finalScore,
    label: valid && finalScore >= 4 ? "Muy fuerte" : labels[finalScore] ?? "Muy débil",
    requirements,
    valid,
  };
}

/**
 * Valida una contraseña y devuelve el primer error encontrado en español
 * (o null si es válida). Ideal para uso en server actions / API.
 */
export function validateStrongPassword(password: string): string | null {
  const r = checkPasswordRequirements(password);
  if (!r.length) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  if (!r.upper) return "La contraseña debe incluir al menos una letra mayúscula";
  if (!r.lower) return "La contraseña debe incluir al menos una letra minúscula";
  if (!r.number) return "La contraseña debe incluir al menos un número";
  if (!r.special) return "La contraseña debe incluir al menos un carácter especial (!@#$...)";
  if (!r.notCommon) return "Esa contraseña es demasiado común. Elegí una más segura";
  return null;
}
