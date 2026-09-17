interface ComingSoonPageProps {
  title: string;
}

export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <section className="rounded-xl border border-ash bg-canvas-white p-16">
      <h1 className="text-heading-sm font-medium text-charcoal">{title}</h1>
      <p className="mt-8 text-body text-steel">
        Este módulo se construye en una fase posterior del roadmap (ver
        PLANTEAMIENTO_SUPERADMIN.md §16).
      </p>
    </section>
  );
}
