export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Organization {
  id: string;
  legalName: string;
  tradeName: string | null;
  ruc: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: 'prospecto' | 'prueba' | 'activo' | 'moroso' | 'suspendido' | 'cerrado';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationContact {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  kind: string | null;
}

export interface OrganizationOverview {
  organization: Organization & { contacts: OrganizationContact[] };
  licenses: License[];
  usage: OrganizationUsage | null;
  recentActivity: unknown[];
}

export type PlatformUserStatus = 'invited' | 'active' | 'suspended';

export interface PlatformUser {
  id: string;
  email: string;
  fullName: string;
  status: PlatformUserStatus;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export type PlanStatus = 'draft' | 'active' | 'archived';

export interface PlanVersion {
  id: string;
  planId: string;
  versionNumber: number;
  name: string;
  priceAmount: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  trialDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  maxWarehouses: number | null;
  apiRequestLimit: number | null;
  storageLimitMb: number | null;
  featureFlags: string[];
  overagePolicy: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  versions: PlanVersion[];
}

export type LicenseStatus =
  | 'draft'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'suspended'
  | 'expired'
  | 'revoked';

export interface LicenseEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface License {
  id: string;
  publicId: string;
  organizationId: string;
  planVersionId: string;
  status: LicenseStatus;
  startsAt: string;
  endsAt: string;
  graceEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  planVersion?: PlanVersion & { plan: Plan };
  organization?: Organization;
  events?: LicenseEvent[];
}

export interface UsageMetricTotal {
  metric: string;
  totalQuantity: number;
  eventCount: number;
}

export interface QuotaStatusItem {
  metric: string;
  limit: number;
  used: number;
  percentUsed: number;
}

export interface UsageSummary {
  from: string;
  to: string;
  metrics: UsageMetricTotal[];
}

export interface UsageTimeseriesPoint {
  periodStart: string;
  totalQuantity: number;
  eventCount: number;
}

export interface UsageTimeseries {
  metric: string;
  granularity: 'hour' | 'day';
  organizationId?: string;
  points: UsageTimeseriesPoint[];
}

export interface OrganizationUsage {
  organizationId: string;
  period: { from: string; to: string };
  metrics: UsageMetricTotal[];
  quotas: QuotaStatusItem[];
}

export type FinancialTransactionType = 'income' | 'expense';
export type FinancialTransactionStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'voided';

export interface FinancialCategory {
  id: string;
  code: string;
  name: string;
  kind: FinancialTransactionType;
  createdAt: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}

export interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  categoryId: string;
  costCenterId: string | null;
  organizationId: string | null;
  counterparty: string | null;
  currency: string;
  amount: number;
  exchangeRate: number | null;
  paymentMethod: string | null;
  description: string | null;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  category?: FinancialCategory;
  costCenter?: CostCenter | null;
}

export interface CashFlowMonth {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface FinanceDashboard {
  period: { months: number; from: string };
  mrr: number;
  arr: number;
  cashFlowByMonth: CashFlowMonth[];
  grossMarginEstimate: { income: number; expense: number; margin: number };
}

export interface AuditLogEntry {
  id: string;
  seq: number;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
