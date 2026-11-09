import crypto from "crypto";

let KEY: Buffer | null = null;
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  if (KEY) return KEY;
  const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be set and at least 32 characters long"
    );
  }
  KEY = Buffer.from(encryptionKey.slice(0, 32), "utf8");
  return KEY;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(encryptedBase64: string): string {
  const key = getKey();
  const data = Buffer.from(encryptedBase64, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return "****";
  const visible = 4;
  return "*".repeat(secret.length - visible) + secret.slice(-visible);
}
