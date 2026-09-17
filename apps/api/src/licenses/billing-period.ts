export type BillingPeriod = 'monthly' | 'yearly';

/**
 * Suma un periodo de facturacion a una fecha. Usa setMonth/setFullYear (no
 * aritmetica de milisegundos) para que sumar "1 mes" a un 31 de enero de
 * como resultado un dia valido de febrero, igual que hace cualquier
 * facturacion basada en meses calendario.
 */
export function addBillingPeriod(date: Date, period: BillingPeriod): Date {
  const result = new Date(date.getTime());
  if (period === 'monthly') {
    result.setMonth(result.getMonth() + 1);
  } else {
    result.setFullYear(result.getFullYear() + 1);
  }
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
