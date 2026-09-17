import { ConflictException } from '@nestjs/common';

/**
 * Estados de licencia segun PLANTEAMIENTO_SUPERADMIN.md SS6.5. `past_due` y
 * `grace_period` son alcanzados por un job de expiracion (no implementado
 * todavia -- ver nota en LicensesService.issue) que compara `endsAt` con la
 * fecha actual; las transiciones de esta tabla son las que dispara un actor
 * humano via la API.
 */
export type LicenseStatus =
  | 'draft'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'suspended'
  | 'expired'
  | 'revoked';

export type LicenseAction = 'renew' | 'suspend' | 'reactivate' | 'revoke';

const ALLOWED_FROM: Record<LicenseAction, LicenseStatus[]> = {
  renew: ['active', 'past_due', 'grace_period', 'expired'],
  suspend: ['trial', 'active', 'past_due', 'grace_period'],
  reactivate: ['suspended'],
  revoke: [
    'draft',
    'trial',
    'active',
    'past_due',
    'grace_period',
    'suspended',
    'expired',
  ],
};

const TARGET_STATUS: Record<LicenseAction, LicenseStatus> = {
  renew: 'active',
  suspend: 'suspended',
  reactivate: 'active',
  revoke: 'revoked',
};

/**
 * Verifica que la transicion sea valida y devuelve el estado destino. Lanza
 * ConflictException (409) si el estado actual no lo permite -- el motivo va
 * en el mensaje para que quede claro en la respuesta de la API, no solo en
 * logs.
 */
export function assertLicenseTransition(
  current: LicenseStatus,
  action: LicenseAction,
): LicenseStatus {
  const allowed = ALLOWED_FROM[action];
  if (!allowed.includes(current)) {
    throw new ConflictException(
      `No se puede ${action} una licencia en estado "${current}". Estados validos: ${allowed.join(', ')}.`,
    );
  }
  return TARGET_STATUS[action];
}
