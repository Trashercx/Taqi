import { authenticator } from 'otplib';
import { MfaService } from './mfa.service';

describe('MfaService', () => {
  const mfaService = new MfaService();

  it('generates a secret and provisioning URI for the given account', () => {
    const { secret, provisioningUri } =
      mfaService.generateSecret('owner@example.com');
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(provisioningUri).toContain('otpauth://totp/');
    expect(provisioningUri).toContain('owner%40example.com');
  });

  it('verifies a code generated from the same secret', () => {
    const { secret } = mfaService.generateSecret('owner@example.com');
    const code = authenticator.generate(secret);
    expect(mfaService.verifyCode(secret, code)).toBe(true);
  });

  it('rejects an incorrect code', () => {
    const { secret } = mfaService.generateSecret('owner@example.com');
    expect(mfaService.verifyCode(secret, '000000')).toBe(false);
  });

  it('rejects a malformed code without throwing', () => {
    const { secret } = mfaService.generateSecret('owner@example.com');
    expect(mfaService.verifyCode(secret, 'not-a-code')).toBe(false);
  });

  it('generates single-use backup codes and consumes them on verification', () => {
    const { plainCodes, hashes } = mfaService.generateBackupCodes(4);
    expect(plainCodes).toHaveLength(4);
    expect(hashes).toHaveLength(4);

    const first = plainCodes[0]!;
    const result = mfaService.verifyBackupCode(hashes, first);
    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(3);

    // El mismo codigo ya no debe ser valido sobre la lista restante (un solo uso).
    const secondAttempt = mfaService.verifyBackupCode(result.remaining, first);
    expect(secondAttempt.valid).toBe(false);
  });

  it('rejects a backup code that was never issued', () => {
    const { hashes } = mfaService.generateBackupCodes(4);
    const result = mfaService.verifyBackupCode(hashes, 'deadbeefdeadbeef');
    expect(result.valid).toBe(false);
    expect(result.remaining).toBe(hashes);
  });
});
