import { monthKey, monthsAgoStart } from './month-key';

describe('monthKey', () => {
  it('formatea con mes de dos digitos', () => {
    expect(monthKey(new Date('2026-03-10T00:00:00.000Z'))).toBe('2026-03');
    expect(monthKey(new Date('2026-11-30T23:59:59.000Z'))).toBe('2026-11');
  });
});

describe('monthsAgoStart', () => {
  it('con 0 devuelve el primer dia del mes de referencia', () => {
    const result = monthsAgoStart(0, new Date('2026-03-27T12:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('retrocede meses cruzando el limite de anio', () => {
    const result = monthsAgoStart(3, new Date('2026-01-15T00:00:00.000Z'));
    expect(result.toISOString()).toBe('2025-10-01T00:00:00.000Z');
  });
});
