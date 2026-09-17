const PLACEHOLDER_KPIS = [
  { label: 'MRR', value: '—' },
  { label: 'Licencias activas', value: '—' },
  { label: 'Próximas a vencer', value: '—' },
  { label: 'Errores últimas 24h', value: '—' },
];

export function DashboardPage() {
  return (
    <section className="flex flex-col gap-16">
      <h1 className="text-heading-sm font-medium text-charcoal">Resumen</h1>
      <div className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-ash bg-canvas-white p-16">
            <p className="text-caption text-fog">{kpi.label}</p>
            <p className="mt-4 text-heading font-medium text-charcoal">{kpi.value}</p>
          </div>
        ))}
      </div>
      <p className="text-body text-steel">
        El dashboard operativo (MRR, consumo, ingresos y gastos) se conecta a datos reales a
        partir de la Fase 3 del roadmap.
      </p>
    </section>
  );
}
