/**
 * Compara consumo contra los limites de un PlanVersion (SS6.4/SS6.6). Solo
 * cubre las dos metricas que mapean 1:1 a un limite numerico simple de
 * medir por evento (api_request, storage_mb). maxUsers/maxBranches/
 * maxProducts/maxWarehouses son limites estructurales que se validan mejor
 * en el momento de crear ese recurso (cuando exista ese modulo), no como
 * una metrica de consumo acumulada.
 */
export interface QuotaPlanLimits {
  apiRequestLimit: number | null;
  storageLimitMb: number | null;
}

export interface QuotaStatusItem {
  metric: string;
  limit: number;
  used: number;
  percentUsed: number;
}

function percent(used: number, limit: number): number {
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.round((used / limit) * 1000) / 10; // 1 decimal
}

export function buildQuotaStatus(
  planLimits: QuotaPlanLimits,
  usageByMetric: ReadonlyMap<string, number>,
): QuotaStatusItem[] {
  const items: QuotaStatusItem[] = [];

  if (planLimits.apiRequestLimit != null) {
    const used = usageByMetric.get('api_request') ?? 0;
    items.push({
      metric: 'api_request',
      limit: planLimits.apiRequestLimit,
      used,
      percentUsed: percent(used, planLimits.apiRequestLimit),
    });
  }

  if (planLimits.storageLimitMb != null) {
    const used = usageByMetric.get('storage_mb') ?? 0;
    items.push({
      metric: 'storage_mb',
      limit: planLimits.storageLimitMb,
      used,
      percentUsed: percent(used, planLimits.storageLimitMb),
    });
  }

  return items;
}
