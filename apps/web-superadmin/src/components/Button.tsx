import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-electric-blue text-white hover:bg-deep-sapphire',
  secondary: 'border border-ash bg-canvas-white text-charcoal hover:bg-paper-mist',
  danger: 'border border-transparent bg-[#dc2626] text-white hover:bg-[#b91c1c]',
  ghost: 'text-charcoal hover:bg-paper-mist',
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-4 rounded-[var(--radius-buttons)] px-16 py-8',
        'text-body font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
      {...props}
    />
  );
}
