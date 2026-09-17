import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { KpiCard } from '../../components/KpiCard';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { LICENSE_STATUS_TONE } from '../../lib/status-tones';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import type { License } from '../../lib/types';

type ActionKind = 'renew' | 'suspend' | 'reactivate' | 'revoke';

const ACTION_LABELS: Record<ActionKind, string> = {
  renew: 'Renovar',
  suspend: 'Suspender',
  reactivate: 'Reactivar',
  revoke: 'Revocar',
};

const ACTION_REQUIRES_REASON: Record<ActionKind, boolean> = {
  renew: false,
  suspend: true,
  reactivate: false,
  revoke: true,
};

const ACTION_ENDPOINT: Record<ActionKind, string> = {
  renew: 'renew',
  suspend: 'suspend',
  reactivate: 'reactivate',
  revoke: 'revoke',
};

export function LicenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasCapability } = useAuth();
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);

  const { data: license, isLoading, error, refetch } = useApi(
    () => api.get<License>(`/licenses/${id}`),
    [id],
  );

  if (isLoading && !license) return <LoadingState />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!license) return null;

  const availableActions: ActionKind[] = [];
  if (['active', 'past_due', 'grace_period', 'expired'].includes(license.status) && hasCapability('licenses.renew')) {
    availableActions.push('renew');
  }
  if (
    ['trial', 'active', 'past_due', 'grace_period'].includes(license.status) &&
    hasCapability('licenses.suspend')
  ) {
    availableActions.push('suspend');
  }
  if (license.status === 'suspended' && hasCapability('licenses.suspend')) {
    availableActions.push('reactivate');
  }
  if (license.status !== 'revoked' && hasCapability('licenses.revoke')) {
    availableActions.push('revoke');
  }

  return (
    <section className="flex flex-col gap-24">
      <div className="flex items-center justify-between gap-16">
        <div>
          <Link to="/licencias" className="text-caption text-fog hover:text-charcoal">
            ← Licencias
          </Link>
          <h1 className="mt-4 font-mono text-heading-sm font-medium text-charcoal">
            {license.publicId}
          </h1>
        </div>
        <StatusBadge label={license.status} tone={LICENSE_STATUS_TONE[license.status]} />
      </div>

      <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Cliente"
          value={license.organization?.legalName ?? '—'}
        />
        <KpiCard
          label="Plan"
          value={`${license.planVersion?.plan.name ?? '—'} (v${license.planVersion?.versionNumber ?? '—'})`}
        />
        <KpiCard
          label="Precio"
          value={
            license.planVersion
              ? formatMoney(license.planVersion.priceAmount, license.planVersion.currency)
              : '—'
          }
        />
        <KpiCard label="Vence" value={formatDate(license.endsAt)} />
      </div>

      {availableActions.length > 0 && (
        <div className="flex flex-wrap gap-8">
          {availableActions.map((action) => (
            <Button
              key={action}
              variant={action === 'revoke' ? 'danger' : action === 'suspend' ? 'secondary' : 'primary'}
              onClick={() => setActiveAction(action)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      )}

      <div>
        <h2 className="mb-8 text-subheading font-medium text-charcoal">Historial de transiciones</h2>
        <div className="flex flex-col gap-8">
          {(license.events ?? []).map((event) => (
            <div key={event.id} className="rounded-xl border border-ash p-12 text-body">
              <p className="text-charcoal">
                {event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : `Creada en ${event.toStatus}`}
              </p>
              {event.reason && <p className="text-caption text-fog">{event.reason}</p>}
              <p className="mt-4 text-caption text-fog">{formatDateTime(event.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>

      {activeAction && (
        <LicenseActionModal
          license={license}
          action={activeAction}
          onClose={() => setActiveAction(null)}
          onDone={() => {
            setActiveAction(null);
            refetch();
          }}
        />
      )}
    </section>
  );
}

function LicenseActionModal({
  license,
  action,
  onClose,
  onDone,
}: {
  license: License;
  action: ActionKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requiresReason = ACTION_REQUIRES_REASON[action];

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/licenses/${license.id}/${ACTION_ENDPOINT[action]}`, {
        reason: reason || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la accion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${ACTION_LABELS[action]} licencia`}>
      <div className="flex flex-col gap-16">
        {error && <ErrorBanner message={error} />}
        <TextField
          label={requiresReason ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required={requiresReason}
        />
        <div className="flex gap-8">
          <Button
            variant={action === 'revoke' ? 'danger' : 'primary'}
            onClick={handleSubmit}
            disabled={isSubmitting || (requiresReason && reason.trim().length < 3)}
          >
            {isSubmitting ? 'Procesando…' : `Confirmar ${ACTION_LABELS[action].toLowerCase()}`}
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
