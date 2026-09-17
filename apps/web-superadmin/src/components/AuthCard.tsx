import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-mist px-16">
      <div className="w-full max-w-sm rounded-2xl border border-ash bg-canvas-white p-32 shadow-sm">
        <p className="text-caption font-medium uppercase tracking-wide text-electric-blue">
          Superadmin
        </p>
        <h1 className="mt-4 text-subheading font-medium text-charcoal">{title}</h1>
        {subtitle && <p className="mt-4 text-body text-fog">{subtitle}</p>}
        <div className="mt-24 flex flex-col gap-16">{children}</div>
      </div>
    </div>
  );
}
