import { cn } from '../../lib/utils'
import { toneClasses, formatLabel, type Tone } from '../../lib/status'

interface StatusBadgeProps {
  label: string
  tone: Tone
  className?: string
}

export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center rounded-full border px-2 text-[11px] font-medium whitespace-nowrap',
        toneClasses(tone),
        className,
      )}
    >
      {formatLabel(label)}
    </span>
  )
}
