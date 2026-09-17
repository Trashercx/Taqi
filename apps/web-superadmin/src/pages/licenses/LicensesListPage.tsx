import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { LICENSE_STATUS_TONE } from '../../lib/status-tones';
import { formatDate } from '../../lib/format';
import type { License, Organization, Paginated, Plan } from '../../lib/types';

const STATUSES = [
  'draft',
  'trial',
  'active',
  'past_due',
  'grace_period',
  'suspended',
  'expired',
  'revoked',
] as const;

export function LicensesListPage() {
  const navigate = useNavigate();
  const { hasCapability } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const organizationId = searchParams.get('organizationId') ?? '';
  const status = searchParams.get('status') ?? '';
  const [isIssueOpen, setIsIssueOpen] = useState(false);

  const { data, isLoading, error, refetch } = useApi(
    () =>
      api.get<Paginated<License>>('/licenses', {
        organizationId: organizationId || undefined,
        status: status || undefined,
        pageSize: 50,
      }),
    [organizationId, status],
  );

  return (
    <section className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <h1 className="text-heading-sm font-medium text-charcoal">Licencias</h1>
        {hasCapability('licenses.issue') && (
          <Button variant="primary" onClick={() => setIsIssueOpen(true)}>
            Emitir licencia
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-12">
        <select
          value={status}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('status', e.target.value);
            else next.delete('status');
            setSearchParams(next);
          }}
          className="rounded-[var(--radius-inputs)] border border-ash bg-canvas-white px-12 py-8 text-body text-charcoal outline-none focus:border-electric-blue"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {organizationId && (
          <button
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('organizationId');
              setSearchParams(next);
            }}
            className="text-caption text-electric-blue hover:underline"
          >
            Quitar filtro de organizacion
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {isLoading && !data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={data?.items ?? []}
          keyFor={(row) => row.id}
          onRowClick={(row) => navigate(`/licencias/${row.id}`)}
          emptyMessage="No hay licencias que coincidan con el filtro."
          columns={[
            { header: 'ID publico', cell: (row) => <span className="font-mono text-caption">{row.publicId}</span> },
            { header: 'Cliente', cell: (row) => row.organization?.legalName ?? '—' },
            { header: 'Plan', cell: (row) => row.planVersion?.plan.name ?? '—' },
            {
              header: 'Estado',
              cell: (row) => <StatusBadge label={row.status} tone={LICENSE_STATUS_TONE[row.status]} />,
            },
            { header: 'Vence', cell: (row) => formatDate(row.endsAt) },
          ]}
        />
      )}
      {data && (
        <p className="text-caption text-fog">
          {data.total} licencia{data.total === 1 ? '' : 's'} en total.
        </p>
      )}

      <Modal open={isIssueOpen} onClose={() => setIsIssueOpen(false)} title="Emitir licencia">
        <IssueLicenseForm
          defaultOrganizationId={organizationId}
          onIssued={(license) => {
            setIsIssueOpen(false);
            refetch();
            navigate(`/licencias/${license.id}`);
          }}
        />
      </Modal>
    </section>
  );
}

function IssueLicenseForm({
  defaultOrganizationId,
  onIssued,
}: {
  defaultOrganizationId: string;
  onIssued: (license: License) => void;
}) {
  const { data: organizations } = useApi(
    () => api.get<Paginated<Organization>>('/organizations', { pageSize: 100 }),
    [],
  );
  const { data: plans } = useApi(() => api.get<Paginated<Plan>>('/plans', { pageSize: 100 }), []);

  const [organizationId, setOrganizationId] = useState(defaultOrganizationId);
  const [planVersionId, setPlanVersionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const versionOptions = (plans?.items ?? []).flatMap((plan) =>
    plan.versions.map((version) => ({
      id: version.id,
      label: `${plan.name} · v${version.versionNumber} · ${version.name}`,
    })),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const license = await api.post<License>('/licenses', { organizationId, planVersionId });
      onIssued(license);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo emitir la licencia.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <SelectField
        label="Cliente"
        value={organizationId}
        onChange={(e) => setOrganizationId(e.target.value)}
        required
      >
        <option value="">Selecciona un cliente…</option>
        {(organizations?.items ?? []).map((org) => (
          <option key={org.id} value={org.id}>
            {org.legalName}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Version de plan"
        value={planVersionId}
        onChange={(e) => setPlanVersionId(e.target.value)}
        required
      >
        <option value="">Selecciona una version…</option>
        {versionOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="primary" disabled={isSubmitting || !organizationId || !planVersionId}>
        {isSubmitting ? 'Emitiendo…' : 'Emitir licencia'}
      </Button>
    </form>
  );
}
