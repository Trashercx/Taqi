import {
  startOfCurrentMonth,
  truncateToDay,
  truncateToHour,
} from './date-bucket';

describe('truncateToHour', () => {
  it('trunca minutos, segundos y milisegundos', () => {
    const result = truncateToHour(new Date('2026-03-10T14:37:52.123Z'));
    expect(result.toISOString()).toBe('2026-03-10T14:00:00.000Z');
  });

  it('no muta la fecha original', () => {
    const original = new Date('2026-03-10T14:37:52.123Z');
    truncateToHour(original);
    expect(original.toISOString()).toBe('2026-03-10T14:37:52.123Z');
  });
});

describe('truncateToDay', () => {
  it('trunca horas, minutos, segundos y milisegundos', () => {
    const result = truncateToDay(new Date('2026-03-10T14:37:52.123Z'));
    expect(result.toISOString()).toBe('2026-03-10T00:00:00.000Z');
  });
});

describe('startOfCurrentMonth', () => {
  it('devuelve el primer dia del mes de la fecha de referencia', () => {
    const result = startOfCurrentMonth(new Date('2026-03-27T23:59:59.000Z'));
    expect(result.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('funciona en diciembre sin desbordar al anio siguiente', () => {
    const result = startOfCurrentMonth(new Date('2026-12-15T00:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});
