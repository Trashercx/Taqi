import { ConflictException } from '@nestjs/common';
import { assertLicenseTransition } from './license-state-machine';

describe('assertLicenseTransition', () => {
  it('permite renovar desde active, past_due, grace_period o expired', () => {
    for (const from of [
      'active',
      'past_due',
      'grace_period',
      'expired',
    ] as const) {
      expect(assertLicenseTransition(from, 'renew')).toBe('active');
    }
  });

  it('no permite renovar una licencia draft, suspendida o revocada', () => {
    for (const from of ['draft', 'suspended', 'revoked'] as const) {
      expect(() => assertLicenseTransition(from, 'renew')).toThrow(
        ConflictException,
      );
    }
  });

  it('permite suspender desde trial, active, past_due o grace_period', () => {
    for (const from of [
      'trial',
      'active',
      'past_due',
      'grace_period',
    ] as const) {
      expect(assertLicenseTransition(from, 'suspend')).toBe('suspended');
    }
  });

  it('no permite suspender una licencia draft, ya suspendida, expirada o revocada', () => {
    for (const from of ['draft', 'suspended', 'expired', 'revoked'] as const) {
      expect(() => assertLicenseTransition(from, 'suspend')).toThrow(
        ConflictException,
      );
    }
  });

  it('solo permite reactivar desde suspended', () => {
    expect(assertLicenseTransition('suspended', 'reactivate')).toBe('active');
    expect(() => assertLicenseTransition('active', 'reactivate')).toThrow(
      ConflictException,
    );
  });

  it('permite revocar desde cualquier estado no terminal', () => {
    for (const from of [
      'draft',
      'trial',
      'active',
      'past_due',
      'grace_period',
      'suspended',
      'expired',
    ] as const) {
      expect(assertLicenseTransition(from, 'revoke')).toBe('revoked');
    }
  });

  it('revocar es terminal: no se puede revocar dos veces', () => {
    expect(() => assertLicenseTransition('revoked', 'revoke')).toThrow(
      ConflictException,
    );
  });

  it('el mensaje de error lista los estados validos para ayudar a diagnosticar', () => {
    expect(() => assertLicenseTransition('revoked', 'renew')).toThrow(
      /Estados validos: active, past_due, grace_period, expired/,
    );
  });
});
