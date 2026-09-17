import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { PLAN_STATUS_TONE } from '../../lib/status-tones';
import { formatMoney } from '../../lib/format';
import type { Paginated, Plan } from '../../lib/types';

const BILLING_PERIODS = ['monthly', 'yearly'] as const;
const OVERAGE_POLICIES = ['block', 'degrade', 'alert', 'charge'] as const;
const OVERAGE_POLICY_LABELS: Record<(typeof OVERAGE_POLICIES)[number], string> = {
  block: 'Bloquear',
  degrade: 'Degradar',
  alert: 'Alertar',
  charge: 'Cobrar adicional',
};

export function PlansListPage() {
  const { hasCapability } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [versionsPlan, setVersionsPlan] = useState<Plan | null>(null);

  const { data, isLoading, error, refetch } = useApi(
    () => api.get<Paginated<Plan>>('/plans', { pageSize: 50 }),
    [],
  );

  return (
    <section className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <h1 className="text-heading-sm font-medium text-charcoal">Planes</h1>
        {hasCapability('plans.manage') && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Nuevo plan
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {isLoading && !data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={data?.items ?? []}
          keyFor={(row) => row.id}
          onRowClick={(row) => setVersionsPlan(row)}
          emptyMessage="Todavia no hay planes creados."
          columns={[
            { header: 'Codigo', cell: (row) => row.code },
            { header: 'Nombre', cell: (row) => row.name },
            {
              header: 'Estado',
              cell: (row) => <StatusBadge label={row.status} tone={PLAN_STATUS_TONE[row.status]} />,
            },
            {
              header: 'Ultima version',
              cell: (row) =>
                row.versions[0]
                  ? `${formatMoney(row.versions[0].priceAmount, row.versions[0].currency)} / ${row.versions[0].billingPeriod === 'monthly' ? 'mes' : 'año'}`
                  : 'Sin versiones',
            },
          ]}
        />
      )}

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo plan">
        <CreatePlanForm
          onCreated={() => {
            setIsCreateOpen(false);
            refetch();
          }}
        />
      </Modal>

      <Modal
        open={versionsPlan !== null}
        onClose={() => setVersionsPlan(null)}
        title={versionsPlan ? `Versiones de ${versionsPlan.name}` : ''}
      >
        {versionsPlan && (
          <PlanVersionsPanel
            plan={versionsPlan}
            canManage={hasCapability('plans.manage')}
            onVersionAdded={() => {
              refetch();
              setVersionsPlan(null);
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function CreatePlanForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/plans', { code, name });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el plan.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <TextField
        label="Codigo (minusculas, sin espacios)"
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="pro"
        required
      />
      <TextField label="Nombre" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear plan'}
      </Button>
    </form>
  );
}

function PlanVersionsPanel({
  plan,
  canManage,
  onVersionAdded,
}: {
  plan: Plan;
  canManage: boolean;
  onVersionAdded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-16">
      {plan.versions.length === 0 ? (
        <p className="text-body text-fog">Este plan todavia no tiene versiones.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {plan.versions.map((version) => (
            <div key={version.id} className="rounded-xl border border-ash p-12">
              <div className="flex items-center justify-between">
                <p className="text-body font-medium text-charcoal">
                  v{version.versionNumber} · {version.name}
                </p>
                <p className="text-body text-charcoal">
                  {formatMoney(version.priceAmount, version.currency)} /{' '}
                  {version.billingPeriod === 'monthly' ? 'mes' : 'año'}
                </p>
              </div>
              <p className="mt-4 text-caption text-fog">
                {version.trialDays > 0 ? `${version.trialDays} dias de prueba · ` : ''}
                {version.maxUsers != null ? `hasta ${version.maxUsers} usuarios · ` : ''}
                {version.apiRequestLimit != null
                  ? `${version.apiRequestLimit} solicitudes API/mes · `
                  : ''}
                politica de exceso: {version.overagePolicy}
              </p>
            </div>
          ))}
        </div>
      )}

      {canManage &&
        (showForm ? (
          <AddPlanVersionForm plan={plan} onAdded={onVersionAdded} />
        ) : (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            Agregar version
          </Button>
        ))}
    </div>
  );
}

function AddPlanVersionForm({ plan, onAdded }: { plan: Plan; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [billingPeriod, setBillingPeriod] = useState<(typeof BILLING_PERIODS)[number]>('monthly');
  const [trialDays, setTrialDays] = useState('0');
  const [maxUsers, setMaxUsers] = useState('');
  const [apiRequestLimit, setApiRequestLimit] = useState('');
  const [storageLimitMb, setStorageLimitMb] = useState('');
  const [overagePolicy, setOveragePolicy] = useState<(typeof OVERAGE_POLICIES)[number]>('alert');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/plans/${plan.id}/versions`, {
        name,
        priceAmount: Math.round(Number(priceAmount) * 100),
        currency,
        billingPeriod,
        trialDays: Number(trialDays) || 0,
        maxUsers: maxUsers ? Number(maxUsers) : undefined,
        apiRequestLimit: apiRequestLimit ? Number(apiRequestLimit) : undefined,
        storageLimitMb: storageLimitMb ? Number(storageLimitMb) : undefined,
        overagePolicy,
      });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar la version.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-16 border-t border-ash pt-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <TextField label="Nombre de la version" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="grid grid-cols-2 gap-16">
        <TextField
          label="Precio (en la unidad de la moneda, ej: 99.00)"
          type="number"
          step="0.01"
          min="0"
          value={priceAmount}
          onChange={(e) => setPriceAmount(e.target.value)}
          required
        />
        <TextField label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} required />
      </div>
      <div className="grid grid-cols-2 gap-16">
        <SelectField
          label="Periodicidad"
          value={billingPeriod}
          onChange={(e) => setBillingPeriod(e.target.value as (typeof BILLING_PERIODS)[number])}
        >
          {BILLING_PERIODS.map((period) => (
            <option key={period} value={period}>
              {period === 'monthly' ? 'Mensual' : 'Anual'}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Dias de prueba"
          type="number"
          min="0"
          value={trialDays}
          onChange={(e) => setTrialDays(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-16">
        <TextField
          label="Max. usuarios"
          type="number"
          min="0"
          value={maxUsers}
          onChange={(e) => setMaxUsers(e.target.value)}
        />
        <TextField
          label="Limite API/mes"
          type="number"
          min="0"
          value={apiRequestLimit}
          onChange={(e) => setApiRequestLimit(e.target.value)}
        />
        <TextField
          label="Limite almacenamiento (MB)"
          type="number"
          min="0"
          value={storageLimitMb}
          onChange={(e) => setStorageLimitMb(e.target.value)}
        />
      </div>
      <SelectField
        label="Politica de exceso"
        value={overagePolicy}
        onChange={(e) => setOveragePolicy(e.target.value as (typeof OVERAGE_POLICIES)[number])}
      >
        {OVERAGE_POLICIES.map((policy) => (
          <option key={policy} value={policy}>
            {OVERAGE_POLICY_LABELS[policy]}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar version'}
      </Button>
    </form>
  );
}
