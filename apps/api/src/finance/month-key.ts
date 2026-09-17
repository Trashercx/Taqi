/** Clave "YYYY-MM" (UTC) de una fecha, para agrupar flujo de caja por mes. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Primer dia (UTC) del mes que empieza `monthsAgo` meses antes del mes de `reference`. */
export function monthsAgoStart(
  monthsAgo: number,
  reference: Date = new Date(),
): Date {
  return new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() - monthsAgo,
      1,
    ),
  );
}
