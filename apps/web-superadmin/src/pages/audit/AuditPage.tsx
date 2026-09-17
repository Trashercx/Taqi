import { useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { TextField } from '../../components/FormFields';
import { LoadingState, ErrorBanner } from '../../components/Feedback';
import { api } from '../../lib/api-client';
import { useApi } from '../../lib/use-api';
import { formatDateTime } from '../../lib/format';
import type { AuditLogEntry, Paginated } from '../../lib/types';

export function AuditPage() {
  const [actorId, setActorId] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading, error, refetch } = useApi(
    () =>
      api.get<Paginated<AuditLogEntry>>('/audit-logs', {
        actorId: actorId || undefined,
        resourceType: resourceType || undefined,
        action: action || undefined,
        pageSize: 50,
      }),
    [actorId, resourceType, action],
  );

  return (
    <section className="flex flex-col gap-16">
      <h1 className="text-heading-sm font-medium text-charcoal">Auditoria</h1>

      <div className="flex flex-wrap gap-16">
        <TextField
          label="Actor (id)"
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder="uuid del actor"
        />
        <TextField
          label="Tipo de recurso"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          placeholder="license, organization…"
        />
        <TextField
          label="Accion"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="licenses.issued…"
        />
      </div>

      {error && <ErrorBanner message={error} onRetry={refetch} />}
      {isLoading && !data ? (
        <LoadingState />
      ) : (
        <DataTable
          rows={data?.items ?? []}
          keyFor={(row) => row.id}
          emptyMessage="No hay eventos que coincidan con el filtro."
          columns={[
            { header: 'Fecha', cell: (row) => formatDateTime(row.createdAt) },
            { header: 'Actor', cell: (row) => row.actorEmail ?? row.actorId ?? 'sistema' },
            { header: 'Accion', cell: (row) => <span className="font-mono text-caption">{row.action}</span> },
            { header: 'Recurso', cell: (row) => `${row.resourceType}${row.resourceId ? ` · ${row.resourceId.slice(0, 8)}…` : ''}` },
            { header: 'Motivo', cell: (row) => row.reason ?? '—' },
          ]}
        />
      )}
      {data && (
        <p className="text-caption text-fog">
          {data.total} evento{data.total === 1 ? '' : 's'} en total (orden mas reciente primero).
        </p>
      )}
    </section>
  );
}
