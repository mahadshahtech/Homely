import crypto from 'crypto';

// Salt for key derivation
const VAULT_SALT = 'homely_family_vault_salt_v2_2026';

// Derive a 256-bit (32-byte) key from the environment variable or fallback secret
function getVaultKey(): Buffer {
  const secret = process.env.VAULT_ENCRYPTION_KEY || 'homely_default_vault_family_secure_key_seed_phrase_2026';
  return crypto.scryptSync(secret, VAULT_SALT, 32);
}

/**
 * Encrypt arbitrary binary buffer with AES-256-GCM.
 * Returns the encrypted buffer, the 12-byte IV, and the 16-byte authentication tag.
 */
export function encryptBuffer(data: Buffer): { encrypted: Buffer; iv: string; authTag: string } {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt an AES-256-GCM encrypted buffer with provided IV and Auth Tag.
 * Throws if authentication tag does not verify (tamper detection).
 */
export function decryptBuffer(encrypted: Buffer, ivHex: string, authTagHex: string): Buffer {
  const key = getVaultKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Encrypt a text string (e.g. WiFi code, safe combo, secret note) with AES-256-GCM.
 */
export function encryptText(plaintext: string): { encryptedHex: string; iv: string; authTag: string } {
  const buf = Buffer.from(plaintext, 'utf8');
  const res = encryptBuffer(buf);
  return {
    encryptedHex: res.encrypted.toString('hex'),
    iv: res.iv,
    authTag: res.authTag
  };
}

/**
 * Decrypt a text string from its encrypted hex, IV hex, and Auth Tag hex.
 */
export function decryptText(encryptedHex: string, ivHex: string, authTagHex: string): string {
  const encryptedBuf = Buffer.from(encryptedHex, 'hex');
  const decryptedBuf = decryptBuffer(encryptedBuf, ivHex, authTagHex);
  return decryptedBuf.toString('utf8');
}
