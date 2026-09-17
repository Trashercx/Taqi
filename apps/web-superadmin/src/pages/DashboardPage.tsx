import { Link } from 'react-router';
import { KpiCard } from '../components/KpiCard';
import { LoadingState, ErrorBanner, InlineNotice } from '../components/Feedback';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api-client';
import { useApi } from '../lib/use-api';
import { useAuth } from '../lib/auth-context';
import { LICENSE_STATUS_TONE } from '../lib/status-tones';
import { daysUntil, formatDate, formatMoney, formatNumber } from '../lib/format';
import type { FinanceDashboard, License, Paginated, UsageSummary } from '../lib/types';

export function DashboardPage() {
  const { hasCapability } = useAuth();

  const canSeeFinance = hasCapability('finance.read');
  const canSeeLicenses = hasCapability('licenses.read');
  const canSeeUsage = hasCapability('usage.read');

  const { data: finance, isLoading: isFinanceLoading, error: financeError } = useApi(
    () => (canSeeFinance ? api.get<FinanceDashboard>('/finance/dashboard', { months: 1 }) : Promise.resolve(null)),
    [canSeeFinance],
  );

  const { data: licenses, isLoading: isLicensesLoading, error: licensesError } = useApi(
    () =>
      canSeeLicenses
        ? api.get<Paginated<License>>('/licenses', { pageSize: 100 })
        : Promise.resolve(null),
    [canSeeLicenses],
  );

  const { data: usage } = useApi(
    () => (canSeeUsage ? api.get<UsageSummary>('/usage/summary') : Promise.resolve(null)),
    [canSeeUsage],
  );

  const activeLicenses = (licenses?.items ?? []).filter((l) =>
    ['active', 'trial'].includes(l.status),
  );
  const expiringSoon = activeLicenses
    .filter((l) => {
      const days = daysUntil(l.endsAt);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());

  return (
    <section className="flex flex-col gap-24">
      <h1 className="text-heading-sm font-medium text-charcoal">Resumen</h1>

      {(financeError || licensesError) && (
        <ErrorBanner message={financeError ?? licensesError ?? ''} />
      )}

      {isFinanceLoading || isLicensesLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="MRR"
            value={finance ? formatMoney(finance.mrr) : '—'}
            hint={finance ? `ARR ${formatMoney(finance.arr)}` : undefined}
          />
          <KpiCard
            label="Licencias activas"
            value={licenses ? formatNumber(activeLicenses.length) : '—'}
          />
          <KpiCard
            label="Por vencer (30 dias)"
            value={licenses ? formatNumber(expiringSoon.length) : '—'}
          />
          <KpiCard
            label="Margen bruto (mes)"
            value={finance ? formatMoney(finance.grossMarginEstimate.margin) : '—'}
          />
        </div>
      )}

      {usage && usage.metrics.length > 0 && (
        <div>
          <h2 className="mb-8 text-subheading font-medium text-charcoal">Consumo del mes</h2>
          <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
            {usage.metrics.slice(0, 4).map((m) => (
              <KpiCard key={m.metric} label={m.metric} value={formatNumber(m.totalQuantity)} />
            ))}
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div>
          <h2 className="mb-8 text-subheading font-medium text-charcoal">
            Licencias proximas a vencer
          </h2>
          <div className="flex flex-col gap-8">
            {expiringSoon.slice(0, 8).map((license) => (
              <Link
                key={license.id}
                to={`/licencias/${license.id}`}
                className="flex items-center justify-between rounded-xl border border-ash p-12 hover:bg-paper-mist/60"
              >
                <div>
                  <p className="text-body text-charcoal">{license.organization?.legalName ?? license.publicId}</p>
                  <p className="text-caption text-fog">{license.planVersion?.plan.name}</p>
                </div>
                <div className="text-right">
                  <StatusBadge label={license.status} tone={LICENSE_STATUS_TONE[license.status]} />
                  <p className="mt-4 text-caption text-fog">Vence {formatDate(license.endsAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <InlineNotice message="Errores recientes y salud de colas/worker todavia no estan disponibles: requieren observabilidad (SS6.6/SS7) que aun no se construyo." />
    </section>
  );
}
