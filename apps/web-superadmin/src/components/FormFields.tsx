import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ label, error, id, name, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="flex flex-col gap-4 text-body">
      <span className="text-caption font-medium text-steel">{label}</span>
      <input
        id={fieldId}
        name={name}
        className={[
          'rounded-[var(--radius-inputs)] border border-ash px-12 py-8 text-body text-charcoal',
          'outline-none focus:border-electric-blue',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <span className="text-caption text-[#b91c1c]">{error}</span>}
    </label>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: ReactNode;
}

export function SelectField({
  label,
  error,
  id,
  name,
  className = '',
  children,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? name;
  return (
    <label className="flex flex-col gap-4 text-body">
      <span className="text-caption font-medium text-steel">{label}</span>
      <select
        id={fieldId}
        name={name}
        className={[
          'rounded-[var(--radius-inputs)] border border-ash bg-canvas-white px-12 py-8 text-body text-charcoal',
          'outline-none focus:border-electric-blue',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-caption text-[#b91c1c]">{error}</span>}
    </label>
  );
}
