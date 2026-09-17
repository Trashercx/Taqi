import type { Tone } from '../components/StatusBadge';

export const ORGANIZATION_STATUS_TONE: Record<string, Tone> = {
  prospecto: 'neutral',
  prueba: 'info',
  activo: 'positive',
  moroso: 'warning',
  suspendido: 'danger',
  cerrado: 'neutral',
};

export const LICENSE_STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  trial: 'info',
  active: 'positive',
  past_due: 'warning',
  grace_period: 'warning',
  suspended: 'danger',
  expired: 'danger',
  revoked: 'danger',
};

export const FINANCE_STATUS_TONE: Record<string, Tone> = {
  pending: 'neutral',
  partial: 'info',
  paid: 'positive',
  overdue: 'danger',
  voided: 'neutral',
};

export const PLATFORM_USER_STATUS_TONE: Record<string, Tone> = {
  invited: 'info',
  active: 'positive',
  suspended: 'danger',
};

export const PLAN_STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  active: 'positive',
  archived: 'neutral',
};
