import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/** Token opaco de alta entropia para refresh tokens e invitaciones. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash de un token ya aleatorio (refresh token, invitacion, codigo de
 * respaldo MFA). No usar para contraseñas humanas: para eso esta
 * PasswordHasher (argon2id), que si necesita costo computacional.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const ALGO = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const hex = process.env.MFA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'MFA_ENCRYPTION_KEY debe ser un valor hexadecimal de 32 bytes (64 caracteres)',
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Cifra el secreto TOTP en reposo (SS6.1). Formato: iv:authTag:ciphertext, todo hex. */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Formato de secreto cifrado invalido');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Hash truncado de la IP para auditoria/sesiones sin guardar la IP en claro. */
export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}
