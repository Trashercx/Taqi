export type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-paper-mist text-steel',
  positive: 'bg-soft-mint text-vivid-green',
  warning: 'bg-[#fef3c7] text-[#b45309]',
  danger: 'bg-[#fee2e2] text-[#b91c1c]',
  info: 'bg-[#dbeaff] text-electric-blue',
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-8 py-2 text-caption font-medium capitalize ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
