import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { KpiCard } from '../../components/KpiCard';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { ORGANIZATION_STATUS_TONE, LICENSE_STATUS_TONE } from '../../lib/status-tones';
import { formatDate } from '../../lib/format';
import type { OrganizationOverview } from '../../lib/types';

const STATUSES = ['prospecto', 'prueba', 'activo', 'moroso', 'suspendido', 'cerrado'] as const;

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasCapability } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, error, refetch } = useApi(
    () => api.get<OrganizationOverview>(`/organizations/${id}/overview`),
    [id],
  );

  if (isLoading && !data) return <LoadingState />;
  if (error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!data) return null;

  const { organization, licenses, usage } = data;

  return (
    <section className="flex flex-col gap-24">
      <div className="flex items-center justify-between gap-16">
        <div>
          <Link to="/clientes" className="text-caption text-fog hover:text-charcoal">
            ← Clientes
          </Link>
          <h1 className="mt-4 text-heading-sm font-medium text-charcoal">
            {organization.legalName}
          </h1>
        </div>
        <div className="flex items-center gap-8">
          <StatusBadge
            label={organization.status}
            tone={ORGANIZATION_STATUS_TONE[organization.status]}
          />
          {hasCapability('organizations.update') && !isEditing && (
            <Button onClick={() => setIsEditing(true)}>Editar</Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <EditOrganizationForm
          organization={organization}
          onSaved={() => {
            setIsEditing(false);
            refetch();
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="RUC" value={organization.ruc ?? '—'} />
          <KpiCard label="Correo" value={organization.email ?? '—'} />
          <KpiCard label="Telefono" value={organization.phone ?? '—'} />
          <KpiCard label="Cliente desde" value={formatDate(organization.createdAt)} />
        </div>
      )}

      {usage && usage.quotas.length > 0 && (
        <div>
          <h2 className="mb-8 text-subheading font-medium text-charcoal">Cuotas del mes</h2>
          <div className="grid grid-cols-1 gap-16 sm:grid-cols-2">
            {usage.quotas.map((quota) => (
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
        </div>
      )}

      <div>
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-subheading font-medium text-charcoal">Licencias</h2>
          {hasCapability('licenses.issue') && (
            <Button onClick={() => navigate(`/licencias?organizationId=${organization.id}`)}>
              Ver en Licencias
            </Button>
          )}
        </div>
        {licenses.length === 0 ? (
          <p className="text-body text-fog">Esta organizacion todavia no tiene licencias.</p>
        ) : (
          <div className="flex flex-col gap-8">
            {licenses.map((license) => (
              <button
                key={license.id}
                onClick={() => navigate(`/licencias/${license.id}`)}
                className="flex items-center justify-between rounded-xl border border-ash p-12 text-left hover:bg-paper-mist/60"
              >
                <div>
                  <p className="font-mono text-caption text-fog">{license.publicId}</p>
                  <p className="text-body text-charcoal">
                    {license.planVersion?.plan.name ?? 'Plan'} · {license.planVersion?.name}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge label={license.status} tone={LICENSE_STATUS_TONE[license.status]} />
                  <p className="mt-4 text-caption text-fog">Vence {formatDate(license.endsAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {organization.contacts.length > 0 && (
        <div>
          <h2 className="mb-8 text-subheading font-medium text-charcoal">Contactos</h2>
          <div className="flex flex-col gap-8">
            {organization.contacts.map((contact) => (
              <div key={contact.id} className="rounded-xl border border-ash p-12 text-body">
                <p className="text-charcoal">{contact.fullName}</p>
                <p className="text-caption text-fog">
                  {[contact.kind, contact.email, contact.phone].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {organization.notes && (
        <div>
          <h2 className="mb-8 text-subheading font-medium text-charcoal">Notas</h2>
          <p className="whitespace-pre-wrap text-body text-steel">{organization.notes}</p>
        </div>
      )}
    </section>
  );
}

function EditOrganizationForm({
  organization,
  onSaved,
  onCancel,
}: {
  organization: OrganizationOverview['organization'];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [legalName, setLegalName] = useState(organization.legalName);
  const [tradeName, setTradeName] = useState(organization.tradeName ?? '');
  const [ruc, setRuc] = useState(organization.ruc ?? '');
  const [email, setEmail] = useState(organization.email ?? '');
  const [phone, setPhone] = useState(organization.phone ?? '');
  const [status, setStatus] = useState(organization.status);
  const [notes, setNotes] = useState(organization.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.patch(`/organizations/${organization.id}`, {
        legalName,
        tradeName: tradeName || undefined,
        ruc: ruc || undefined,
        email: email || undefined,
        phone: phone || undefined,
        status,
        notes: notes || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-16 rounded-xl border border-ash p-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <div className="grid grid-cols-1 gap-16 sm:grid-cols-2">
        <TextField label="Razon social" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
        <TextField label="Nombre comercial" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        <TextField label="RUC" value={ruc} onChange={(e) => setRuc(e.target.value)} />
        <TextField label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <SelectField
          label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
      </div>
      <label className="flex flex-col gap-4 text-body">
        <span className="text-caption font-medium text-steel">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-[var(--radius-inputs)] border border-ash px-12 py-8 text-body text-charcoal outline-none focus:border-electric-blue"
        />
      </label>
      <div className="flex gap-8">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
