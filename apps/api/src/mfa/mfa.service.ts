import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';
import { hashOpaqueToken } from '../common/crypto';

export interface GeneratedMfaSecret {
  secret: string;
  provisioningUri: string;
}

export interface GeneratedBackupCodes {
  plainCodes: string[];
  hashes: string[];
}

/** TOTP (RFC 6238) + codigos de respaldo de un solo uso, SS6.1. */
@Injectable()
export class MfaService {
  generateSecret(accountEmail: string): GeneratedMfaSecret {
    const secret = authenticator.generateSecret();
    const provisioningUri = authenticator.keyuri(
      accountEmail,
      'Superadmin SaaS',
      secret,
    );
    return { secret, provisioningUri };
  }

  verifyCode(secret: string, code: string): boolean {
    try {
      return authenticator.check(code, secret);
    } catch {
      return false;
    }
  }

  generateBackupCodes(count = 8): GeneratedBackupCodes {
    const plainCodes = Array.from({ length: count }, () =>
      randomBytes(5).toString('hex'),
    );
    return { plainCodes, hashes: plainCodes.map(hashOpaqueToken) };
  }

  verifyBackupCode(
    hashes: string[],
    candidate: string,
  ): { valid: boolean; remaining: string[] } {
    const candidateHash = hashOpaqueToken(candidate);
    const index = hashes.indexOf(candidateHash);
    if (index === -1) return { valid: false, remaining: hashes };
    const remaining = [...hashes];
    remaining.splice(index, 1);
    return { valid: true, remaining };
  }
}
