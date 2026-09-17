import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { SelectField, TextField } from '../../components/FormFields';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { KpiCard } from '../../components/KpiCard';
import { api } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { formatNumber } from '../../lib/format';
import type {
  OrganizationUsage,
  Organization,
  Paginated,
  UsageSummary,
  UsageTimeseries,
} from '../../lib/types';

export function UsagePage() {
  const [organizationId, setOrganizationId] = useState('');
  const [metric, setMetric] = useState('api_request');
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day');

  const { data: organizations } = useApi(
    () => api.get<Paginated<Organization>>('/organizations', { pageSize: 100 }),
    [],
  );

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useApi(() => api.get<UsageSummary>('/usage/summary'), []);

  const {
    data: timeseries,
    isLoading: isTimeseriesLoading,
    error: timeseriesError,
    refetch: refetchTimeseries,
  } = useApi(
    () =>
      api.get<UsageTimeseries>('/usage/timeseries', {
        metric,
        organizationId: organizationId || undefined,
        granularity,
      }),
    [metric, organizationId, granularity],
  );

  const { data: orgUsage } = useApi(
    () =>
      organizationId
        ? api.get<OrganizationUsage>(`/usage/organizations/${organizationId}`)
        : Promise.resolve(null),
    [organizationId],
  );

  const maxQuantity = Math.max(1, ...(timeseries?.points.map((p) => p.totalQuantity) ?? [0]));

  return (
    <section className="flex flex-col gap-24">
      <h1 className="text-heading-sm font-medium text-charcoal">Consumo</h1>

      <div>
        <h2 className="mb-8 text-subheading font-medium text-charcoal">
          Resumen del mes en curso (toda la plataforma)
        </h2>
        {summaryError && <ErrorBanner message={summaryError} />}
        {isSummaryLoading && !summary ? (
          <LoadingState />
        ) : summary && summary.metrics.length > 0 ? (
          <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
            {summary.metrics.map((m) => (
              <KpiCard key={m.metric} label={m.metric} value={formatNumber(m.totalQuantity)} hint={`${m.eventCount} eventos`} />
            ))}
          </div>
        ) : (
          <p className="text-body text-fog">Todavia no hay eventos de consumo registrados este mes.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-16">
        <SelectField
          label="Cliente (opcional, en blanco = toda la plataforma)"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          <option value="">Toda la plataforma</option>
          {(organizations?.items ?? []).map((org) => (
            <option key={org.id} value={org.id}>
              {org.legalName}
            </option>
          ))}
        </SelectField>
        <TextField label="Metrica" value={metric} onChange={(e) => setMetric(e.target.value)} />
        <SelectField
          label="Granularidad"
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as 'day' | 'hour')}
        >
          <option value="day">Por dia</option>
          <option value="hour">Por hora</option>
        </SelectField>
      </div>

      {timeseriesError && <ErrorBanner message={timeseriesError} onRetry={refetchTimeseries} />}
      {isTimeseriesLoading && !timeseries ? (
        <LoadingState />
      ) : !timeseries || timeseries.points.length === 0 ? (
        <p className="text-body text-fog">Sin datos para esta combinacion de filtros.</p>
      ) : (
        <div className="rounded-xl border border-ash p-16">
          <div className="flex h-[160px] items-end gap-4">
            {timeseries.points.map((point) => (
              <div key={point.periodStart} className="flex flex-1 flex-col items-center gap-4">
                <div
                  className="w-full rounded-t-sm bg-electric-blue"
                  style={{ height: `${(point.totalQuantity / maxQuantity) * 140}px` }}
                  title={`${point.totalQuantity} (${point.eventCount} eventos)`}
                />
              </div>
            ))}
          </div>
          <p className="mt-8 text-caption text-fog">
            {timeseries.points.length} puntos · maximo {formatNumber(maxQuantity)}
          </p>
        </div>
      )}

      {organizationId && orgUsage && (
        <div>
          <h2 className="mb-8 text-subheading font-medium text-charcoal">
            Desglose del mes en curso para este cliente
          </h2>
          <DataTable
            rows={orgUsage.metrics}
            keyFor={(row) => row.metric}
            emptyMessage="Sin consumo registrado este mes."
            columns={[
              { header: 'Metrica', cell: (row) => row.metric },
              { header: 'Total', cell: (row) => formatNumber(row.totalQuantity) },
              { header: 'Eventos', cell: (row) => formatNumber(row.eventCount) },
            ]}
          />
          {orgUsage.quotas.length > 0 && (
            <div className="mt-16 grid grid-cols-1 gap-16 sm:grid-cols-2">
              {orgUsage.quotas.map((quota) => (
                <div key={quota.metric} className="rounded-xl border border-ash p-16">
                  <div className="flex items-center justify-between text-caption text-fog">
                    <span>{quota.metric}</span>
                    <span>
                      {quota.used} / {quota.limit}
                    </span>
                  </div>
                  <div className="mt-8 h-8 overflow-hidden rounded-full bg-paper-mist">
                    <div
                      className={`h-full rounded-full ${quota.percentUsed >= 100 ? 'bg-[#dc2626]' : quota.percentUsed >= 85 ? 'bg-tangerine' : 'bg-electric-blue'}`}
                      style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
                    />
                  </div>
                  <p className="mt-4 text-caption text-fog">{quota.percentUsed}% usado</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
