// Encriptación AES-256-GCM para historia clínica.
// La clave maestra vive en variables de entorno del servidor (Edge Function / API Route).
// NUNCA se expone al cliente ni se almacena en la DB.

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // bytes — recomendado para GCM

// Importa la clave maestra desde la variable de entorno (hex de 64 chars = 32 bytes)
async function getMasterKey(): Promise<CryptoKey> {
  const hexKey = process.env["CLINICAL_RECORD_ENCRYPTION_KEY"];

  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      "CLINICAL_RECORD_ENCRYPTION_KEY inválida: debe ser un hex de 64 caracteres (32 bytes)"
    );
  }

  const keyBytes = Buffer.from(hexKey, "hex");

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encripta texto plano y devuelve { ciphertext, iv } como Base64
export async function encryptClinicalRecord(
  plaintext: string
): Promise<{ contentEncrypted: string; iv: string }> {
  const key = await getMasterKey();
  const ivBytes = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: ivBytes },
    key,
    encoded
  );

  // Supabase/PostgREST espera bytea como hex con prefijo \x
  return {
    contentEncrypted: "\\x" + Buffer.from(cipherBuffer).toString("hex"),
    iv: "\\x" + Buffer.from(ivBytes).toString("hex"),
  };
}

// Desencripta y devuelve el texto plano
export async function decryptClinicalRecord(
  contentEncrypted: string,
  iv: string
): Promise<string> {
  const key = await getMasterKey();
  // Supabase devuelve bytea como hex con prefijo \x
  const cleanEncrypted = contentEncrypted.startsWith("\\x")
    ? contentEncrypted.slice(2)
    : contentEncrypted;
  const cleanIv = iv.startsWith("\\x") ? iv.slice(2) : iv;
  const cipherBuffer = Buffer.from(cleanEncrypted, "hex");
  const ivBytes = Buffer.from(cleanIv, "hex");

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    key,
    cipherBuffer
  );

  return new TextDecoder().decode(plainBuffer);
}
