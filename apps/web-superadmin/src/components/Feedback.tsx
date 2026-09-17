export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return <p className="px-4 py-16 text-body text-fog">{label}</p>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-16 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-16 py-12 text-body text-[#b91c1c]">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-[var(--radius-buttons)] border border-[#fecaca] px-12 py-4 text-caption font-medium text-[#b91c1c] hover:bg-[#fee2e2]"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function InlineNotice({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-ash bg-paper-mist px-16 py-12 text-body text-steel">
      {message}
    </p>
  );
}
