import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { KpiCard } from '../../components/KpiCard';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { FINANCE_STATUS_TONE } from '../../lib/status-tones';
import { formatDate, formatMoney } from '../../lib/format';
import type {
  CostCenter,
  FinanceDashboard,
  FinancialCategory,
  FinancialTransaction,
  Paginated,
} from '../../lib/types';

const TYPES = ['income', 'expense'] as const;

export function FinancePage() {
  const { hasCapability } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<FinancialTransaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useApi(() => api.get<FinanceDashboard>('/finance/dashboard'), []);

  const {
    data: transactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useApi(
    () => api.get<Paginated<FinancialTransaction>>('/finance/transactions', { pageSize: 50 }),
    [],
  );

  const canWrite = hasCapability('finance.write');

  async function markAsPaid(transaction: FinancialTransaction) {
    setActionError(null);
    try {
      await api.patch(`/finance/transactions/${transaction.id}`, {
        version: transaction.version,
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      refetchTransactions();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo actualizar el movimiento.');
    }
  }

  return (
    <section className="flex flex-col gap-24">
      <h1 className="text-heading-sm font-medium text-charcoal">Finanzas</h1>

      {dashboardError && <ErrorBanner message={dashboardError} />}
      {isDashboardLoading && !dashboard ? (
        <LoadingState />
      ) : (
        dashboard && (
          <>
            <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="MRR" value={formatMoney(dashboard.mrr)} />
              <KpiCard label="ARR" value={formatMoney(dashboard.arr)} />
              <KpiCard
                label={`Ingresos pagados (${dashboard.period.months} meses)`}
                value={formatMoney(dashboard.grossMarginEstimate.income)}
              />
              <KpiCard
                label="Margen bruto estimado"
                value={formatMoney(dashboard.grossMarginEstimate.margin)}
              />
            </div>
            <div className="rounded-xl border border-ash p-16">
              <p className="mb-8 text-caption font-medium text-fog">Flujo de caja por mes</p>
              <div className="flex h-[140px] items-end gap-8">
                {dashboard.cashFlowByMonth.map((month) => {
                  const max = Math.max(
                    1,
                    ...dashboard.cashFlowByMonth.map((m) => Math.max(m.income, m.expense)),
                  );
                  return (
                    <div key={month.month} className="flex flex-1 flex-col items-center gap-4">
                      <div className="flex h-[110px] items-end gap-2">
                        <div
                          className="w-8 rounded-t-sm bg-vivid-green"
                          style={{ height: `${(month.income / max) * 110}px` }}
                          title={`Ingresos: ${formatMoney(month.income)}`}
                        />
                        <div
                          className="w-8 rounded-t-sm bg-[#dc2626]"
                          style={{ height: `${(month.expense / max) * 110}px` }}
                          title={`Gastos: ${formatMoney(month.expense)}`}
                        />
                      </div>
                      <span className="text-caption text-fog">{month.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )
      )}

      <div className="flex items-center justify-between gap-16">
        <h2 className="text-subheading font-medium text-charcoal">Movimientos</h2>
        {canWrite && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Nuevo movimiento
          </Button>
        )}
      </div>

      {transactionsError && <ErrorBanner message={transactionsError} onRetry={refetchTransactions} />}
      {actionError && <ErrorBanner message={actionError} />}
      {isTransactionsLoading && !transactions ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={transactions?.items ?? []}
          keyFor={(row) => row.id}
          emptyMessage="Todavia no hay movimientos registrados."
          columns={[
            { header: 'Fecha', cell: (row) => formatDate(row.issuedAt) },
            { header: 'Tipo', cell: (row) => (row.type === 'income' ? 'Ingreso' : 'Gasto') },
            { header: 'Categoria', cell: (row) => row.category?.name ?? '—' },
            { header: 'Contraparte', cell: (row) => row.counterparty ?? '—' },
            {
              header: 'Monto',
              cell: (row) => (
                <span className={row.type === 'income' ? 'text-vivid-green' : 'text-[#b91c1c]'}>
                  {row.type === 'income' ? '+' : '−'} {formatMoney(row.amount, row.currency)}
                </span>
              ),
            },
            {
              header: 'Estado',
              cell: (row) => <StatusBadge label={row.status} tone={FINANCE_STATUS_TONE[row.status]} />,
            },
            ...(canWrite
              ? [
                  {
                    header: 'Acciones',
                    cell: (row: FinancialTransaction) =>
                      row.status === 'voided' ? (
                        <span className="text-caption text-fog">—</span>
                      ) : (
                        <div className="flex gap-8">
                          {row.status !== 'paid' && (
                            <button
                              className="text-caption text-electric-blue hover:underline"
                              onClick={() => markAsPaid(row)}
                            >
                              Marcar pagado
                            </button>
                          )}
                          <button
                            className="text-caption text-[#b91c1c] hover:underline"
                            onClick={() => setVoidTarget(row)}
                          >
                            Anular
                          </button>
                        </div>
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nuevo movimiento">
        <CreateTransactionForm
          onCreated={() => {
            setIsCreateOpen(false);
            refetchTransactions();
          }}
        />
      </Modal>

      {voidTarget && (
        <VoidTransactionModal
          transaction={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={() => {
            setVoidTarget(null);
            refetchTransactions();
          }}
        />
      )}
    </section>
  );
}

function CreateTransactionForm({ onCreated }: { onCreated: () => void }) {
  const { data: categories } = useApi(
    () => api.get<FinancialCategory[]>('/finance/categories'),
    [],
  );
  const { data: costCenters } = useApi(() => api.get<CostCenter[]>('/finance/cost-centers'), []);

  const [type, setType] = useState<(typeof TYPES)[number]>('income');
  const [categoryId, setCategoryId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matchingCategories = (categories ?? []).filter((c) => c.kind === type);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/finance/transactions', {
        type,
        categoryId,
        costCenterId: costCenterId || undefined,
        counterparty: counterparty || undefined,
        amount: Math.round(Number(amount) * 100),
        currency,
        issuedAt: new Date(issuedAt).toISOString(),
        description: description || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <SelectField
        label="Tipo"
        value={type}
        onChange={(e) => {
          setType(e.target.value as (typeof TYPES)[number]);
          setCategoryId('');
        }}
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t === 'income' ? 'Ingreso' : 'Gasto'}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Categoria"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        required
      >
        <option value="">Selecciona una categoria…</option>
        {matchingCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Centro de costo (opcional)"
        value={costCenterId}
        onChange={(e) => setCostCenterId(e.target.value)}
      >
        <option value="">Sin centro de costo</option>
        {(costCenters ?? []).map((cc) => (
          <option key={cc.id} value={cc.id}>
            {cc.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Contraparte (opcional)"
        value={counterparty}
        onChange={(e) => setCounterparty(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-16">
        <TextField
          label="Monto"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <TextField label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} required />
      </div>
      <TextField
        label="Fecha de emision"
        type="date"
        value={issuedAt}
        onChange={(e) => setIssuedAt(e.target.value)}
        required
      />
      <TextField
        label="Descripcion (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Guardar movimiento'}
      </Button>
    </form>
  );
}

function VoidTransactionModal({
  transaction,
  onClose,
  onVoided,
}: {
  transaction: FinancialTransaction;
  onClose: () => void;
  onVoided: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/finance/transactions/${transaction.id}/void`, {
        version: transaction.version,
        reason,
      });
      onVoided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anular el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Anular movimiento">
      <div className="flex flex-col gap-16">
        <p className="text-body text-steel">
          Los movimientos financieros nunca se borran; anular deja el registro visible con el motivo.
        </p>
        {error && <ErrorBanner message={error} />}
        <TextField
          label="Motivo (obligatorio)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <div className="flex gap-8">
          <Button variant="danger" onClick={handleSubmit} disabled={isSubmitting || reason.trim().length < 3}>
            {isSubmitting ? 'Anulando…' : 'Confirmar anulacion'}
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
