import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { TextField, SelectField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { ORGANIZATION_STATUS_TONE } from '../../lib/status-tones';
import { formatDate } from '../../lib/format';
import type { Organization, Paginated } from '../../lib/types';

const STATUSES = ['prospecto', 'prueba', 'activo', 'moroso', 'suspendido', 'cerrado'] as const;

export function OrganizationsListPage() {
  const navigate = useNavigate();
  const { hasCapability } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, error, refetch } = useApi(
    () =>
      api.get<Paginated<Organization>>('/organizations', {
        search: search || undefined,
        status: status || undefined,
        pageSize: 50,
      }),
    [search, status],
  );

  return (
    <section className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <h1 className="text-heading-sm font-medium text-charcoal">Clientes</h1>
        {hasCapability('organizations.create') && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Nuevo cliente
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-12">
        <input
          type="search"
          placeholder="Buscar por razon social, nombre comercial o RUC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[280px] flex-1 rounded-[var(--radius-inputs)] border border-ash px-12 py-8 text-body text-charcoal outline-none focus:border-electric-blue"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-[var(--radius-inputs)] border border-ash bg-canvas-white px-12 py-8 text-body text-charcoal outline-none focus:border-electric-blue"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {isLoading && !data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={data?.items ?? []}
          keyFor={(row) => row.id}
          onRowClick={(row) => navigate(`/clientes/${row.id}`)}
          emptyMessage="No hay clientes que coincidan con el filtro."
          columns={[
            { header: 'Razon social', cell: (row) => row.legalName },
            { header: 'RUC', cell: (row) => row.ruc ?? '—' },
            { header: 'Correo', cell: (row) => row.email ?? '—' },
            {
              header: 'Estado',
              cell: (row) => (
                <StatusBadge label={row.status} tone={ORGANIZATION_STATUS_TONE[row.status]} />
              ),
            },
            { header: 'Creado', cell: (row) => formatDate(row.createdAt) },
          ]}
        />
      )}
      {data && (
        <p className="text-caption text-fog">
          {data.total} cliente{data.total === 1 ? '' : 's'} en total.
        </p>
      )}

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo cliente">
        <CreateOrganizationForm
          onCreated={() => {
            setIsCreateOpen(false);
            refetch();
          }}
        />
      </Modal>
    </section>
  );
}

function CreateOrganizationForm({ onCreated }: { onCreated: () => void }) {
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [ruc, setRuc] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('prospecto');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/organizations', {
        legalName,
        tradeName: tradeName || undefined,
        ruc: ruc || undefined,
        email: email || undefined,
        status,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <TextField
        label="Razon social"
        name="legalName"
        value={legalName}
        onChange={(e) => setLegalName(e.target.value)}
        required
      />
      <TextField
        label="Nombre comercial (opcional)"
        name="tradeName"
        value={tradeName}
        onChange={(e) => setTradeName(e.target.value)}
      />
      <TextField
        label="RUC (opcional)"
        name="ruc"
        value={ruc}
        onChange={(e) => setRuc(e.target.value)}
      />
      <TextField
        label="Correo (opcional)"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <SelectField
        label="Estado inicial"
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear cliente'}
      </Button>
    </form>
  );
}
