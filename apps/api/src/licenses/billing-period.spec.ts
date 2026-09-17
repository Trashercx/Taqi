import { addBillingPeriod, addDays } from './billing-period';

describe('addBillingPeriod', () => {
  it('suma un mes calendario', () => {
    const result = addBillingPeriod(
      new Date('2026-03-10T00:00:00.000Z'),
      'monthly',
    );
    expect(result.toISOString()).toBe('2026-04-10T00:00:00.000Z');
  });

  it('suma un anio calendario', () => {
    const result = addBillingPeriod(
      new Date('2026-03-10T00:00:00.000Z'),
      'yearly',
    );
    expect(result.toISOString()).toBe('2027-03-10T00:00:00.000Z');
  });

  it('maneja el desborde de fin de mes (31 de enero + 1 mes)', () => {
    const result = addBillingPeriod(
      new Date('2026-01-31T00:00:00.000Z'),
      'monthly',
    );
    // JS normaliza el desborde: 31 de enero + 1 mes = 2 o 3 de marzo segun
    // el mes tenga 28/29 dias. Se documenta el comportamiento, no se oculta.
    expect(result.getUTCMonth()).not.toBe(1); // no se queda "atascado" en febrero
  });

  it('no muta la fecha original', () => {
    const original = new Date('2026-03-10T00:00:00.000Z');
    addBillingPeriod(original, 'monthly');
    expect(original.toISOString()).toBe('2026-03-10T00:00:00.000Z');
  });
});

describe('addDays', () => {
  it('suma dias calendario', () => {
    const result = addDays(new Date('2026-03-10T00:00:00.000Z'), 14);
    expect(result.toISOString()).toBe('2026-03-24T00:00:00.000Z');
  });

  it('con 0 dias devuelve la misma fecha', () => {
    const original = new Date('2026-03-10T00:00:00.000Z');
    expect(addDays(original, 0).toISOString()).toBe(original.toISOString());
  });
});
