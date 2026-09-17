import { buildQuotaStatus } from './quota-status';

describe('buildQuotaStatus', () => {
  it('omite limites que el plan no define (null)', () => {
    const items = buildQuotaStatus(
      { apiRequestLimit: null, storageLimitMb: null },
      new Map(),
    );
    expect(items).toEqual([]);
  });

  it('calcula el porcentaje usado con un decimal', () => {
    const items = buildQuotaStatus(
      { apiRequestLimit: 10000, storageLimitMb: null },
      new Map([['api_request', 3333]]),
    );
    expect(items).toEqual([
      { metric: 'api_request', limit: 10000, used: 3333, percentUsed: 33.3 },
    ]);
  });

  it('sin uso registrado, used es 0 y percentUsed es 0', () => {
    const items = buildQuotaStatus(
      { apiRequestLimit: 1000, storageLimitMb: 500 },
      new Map(),
    );
    expect(items).toEqual([
      { metric: 'api_request', limit: 1000, used: 0, percentUsed: 0 },
      { metric: 'storage_mb', limit: 500, used: 0, percentUsed: 0 },
    ]);
  });

  it('permite superar el 100% (sobreconsumo)', () => {
    const items = buildQuotaStatus(
      { apiRequestLimit: 100, storageLimitMb: null },
      new Map([['api_request', 150]]),
    );
    expect(items[0]!.percentUsed).toBe(150);
  });

  it('un limite en 0 con algo de uso se reporta como 100%, no Infinity', () => {
    const items = buildQuotaStatus(
      { apiRequestLimit: 0, storageLimitMb: null },
      new Map([['api_request', 5]]),
    );
    expect(items[0]!.percentUsed).toBe(100);
  });
});
