import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/FormFields';
import { Modal } from '../../components/Modal';
import { LoadingState, ErrorBanner, InlineNotice } from '../../components/Feedback';
import { api, ApiError } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { useAuth } from '../../lib/auth-context';
import { PLATFORM_USER_STATUS_TONE } from '../../lib/status-tones';
import { formatDateTime } from '../../lib/format';
import type { Paginated, PlatformUser } from '../../lib/types';

// No hay GET /roles en la API: los codigos de rol son el mismo catalogo
// fijo que apps/api/src/rbac/roles.seed-data.ts.
const ROLES = [
  { code: 'platform_owner', label: 'Platform Owner' },
  { code: 'superadmin', label: 'Superadmin' },
  { code: 'finance_admin', label: 'Finance Admin' },
  { code: 'support_agent', label: 'Support Agent' },
  { code: 'auditor', label: 'Auditor' },
];

export function UsersListPage() {
  const { hasCapability } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useApi(
    () => api.get<Paginated<PlatformUser>>('/users', { pageSize: 50 }),
    [],
  );

  const canManage = hasCapability('users.reset_credentials');

  async function handleAction(id: string, action: 'suspend' | 'revoke-sessions' | 'reset-credentials') {
    setActionError(null);
    try {
      await api.post(`/users/${id}/${action}`, {});
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo completar la accion.');
    }
  }

  return (
    <section className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <h1 className="text-heading-sm font-medium text-charcoal">Usuarios</h1>
        {hasCapability('users.invite') && (
          <Button variant="primary" onClick={() => setIsInviteOpen(true)}>
            Invitar usuario
          </Button>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {actionError && <ErrorBanner message={actionError} />}
      {isLoading && !data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={data?.items ?? []}
          keyFor={(row) => row.id}
          emptyMessage="No hay usuarios de plataforma registrados."
          columns={[
            { header: 'Nombre', cell: (row) => row.fullName },
            { header: 'Correo', cell: (row) => row.email },
            { header: 'Roles', cell: (row) => row.roles.join(', ') || '—' },
            {
              header: 'Estado',
              cell: (row) => (
                <StatusBadge label={row.status} tone={PLATFORM_USER_STATUS_TONE[row.status]} />
              ),
            },
            { header: 'Ultimo acceso', cell: (row) => formatDateTime(row.lastLoginAt) },
            ...(canManage
              ? [
                  {
                    header: 'Acciones',
                    cell: (row: PlatformUser) => (
                      <div className="flex flex-wrap gap-4">
                        <button
                          className="text-caption text-electric-blue hover:underline disabled:text-fog"
                          disabled={row.status === 'suspended'}
                          onClick={() => handleAction(row.id, 'suspend')}
                        >
                          Suspender
                        </button>
                        <button
                          className="text-caption text-electric-blue hover:underline"
                          onClick={() => handleAction(row.id, 'revoke-sessions')}
                        >
                          Revocar sesiones
                        </button>
                        <button
                          className="text-caption text-electric-blue hover:underline"
                          onClick={() => handleAction(row.id, 'reset-credentials')}
                        >
                          Reiniciar credenciales
                        </button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {data && (
        <p className="text-caption text-fog">
          {data.total} usuario{data.total === 1 ? '' : 's'} en total.
        </p>
      )}

      <Modal open={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invitar usuario">
        <InviteUserForm
          onInvited={() => {
            refetch();
          }}
        />
      </Modal>
    </section>
  );
}

function InviteUserForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleCode, setRoleCode] = useState(ROLES[1]!.code);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<{ invitationToken: string }>('/users/invitations', {
        email,
        fullName,
        roleCode,
      });
      setInvitationLink(`${window.location.origin}/aceptar-invitacion/${res.invitationToken}`);
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo invitar al usuario.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (invitationLink) {
    return (
      <div className="flex flex-col gap-16">
        <InlineNotice message="No hay proveedor de correo configurado todavia: comparte este enlace de un solo uso directamente con la persona invitada (vence en 7 dias)." />
        <div className="rounded-xl border border-ash bg-paper-mist px-12 py-8">
          <p className="break-all font-mono text-caption text-charcoal">{invitationLink}</p>
        </div>
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(invitationLink);
          }}
        >
          Copiar enlace
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
      {error && <ErrorBanner message={error} />}
      <TextField
        label="Nombre completo"
        name="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      <TextField
        label="Correo"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <SelectField label="Rol" value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
        {ROLES.map((role) => (
          <option key={role.code} value={role.code}>
            {role.label}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Invitando…' : 'Enviar invitacion'}
      </Button>
    </form>
  );
}
