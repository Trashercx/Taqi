export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-ash bg-canvas-white p-16">
      <p className="text-caption text-fog">{label}</p>
      <p className="mt-4 text-heading font-medium text-charcoal">{value}</p>
      {hint && <p className="mt-4 text-caption text-fog">{hint}</p>}
    </div>
  );
}
