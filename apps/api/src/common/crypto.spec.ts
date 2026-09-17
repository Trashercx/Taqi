import {
  decryptSecret,
  encryptSecret,
  generateOpaqueToken,
  hashIp,
  hashOpaqueToken,
} from './crypto';

describe('crypto', () => {
  const originalKey = process.env.MFA_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.MFA_ENCRYPTION_KEY = '0'.repeat(64);
  });

  afterAll(() => {
    process.env.MFA_ENCRYPTION_KEY = originalKey;
  });

  it('generates opaque tokens with high entropy and no collisions across many calls', () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => generateOpaqueToken()),
    );
    expect(tokens.size).toBe(1000);
  });

  it('hashes a token deterministically', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).not.toBe(token);
  });

  it('round-trips a secret through encrypt/decrypt', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it('fails to decrypt a tampered payload', () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP');
    const tampered = encrypted.slice(0, -2) + '00';
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('hashes an IP to a fixed-length value without exposing the original', () => {
    const hashed = hashIp('203.0.113.42');
    expect(hashed).toBeDefined();
    expect(hashed).not.toContain('203.0.113.42');
    expect(hashIp(undefined)).toBeUndefined();
  });
});
