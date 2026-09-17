/** Trunca una fecha al inicio de su hora UTC (para usage_aggregates_hourly). */
export function truncateToHour(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCMinutes(0, 0, 0);
  return result;
}

/** Trunca una fecha al inicio de su dia UTC (para usage_aggregates_daily). */
export function truncateToDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/** Inicio del mes calendario UTC actual (o del que se pase como referencia). */
export function startOfCurrentMonth(reference: Date = new Date()): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
}
