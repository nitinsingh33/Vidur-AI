import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

const toneStyles = {
  primary: {
    icon: 'text-primary',
    iconHover: 'group-hover:text-primary',
  },
  emerald: {
    icon: 'text-emerald-600',
    iconHover: 'group-hover:text-emerald-600',
  },
  amber: {
    icon: 'text-amber-600',
    iconHover: 'group-hover:text-amber-600',
  },
  rose: {
    icon: 'text-rose-600',
    iconHover: 'group-hover:text-rose-600',
  },
  sky: {
    icon: 'text-sky-600',
    iconHover: 'group-hover:text-sky-600',
  },
} as const

interface MetricCardProps {
  label: string
  value: string
  description: string
  icon: LucideIcon
  tone?: keyof typeof toneStyles
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'primary',
}: MetricCardProps) {
  const styles = toneStyles[tone]

  return (
    <article
      className={cn(
        'group relative rounded-xl border border-border bg-card px-5 py-5',
        'transition-all duration-200',
        'hover:-translate-y-[1px] hover:border-border/80 hover:shadow-[0_4px_18px_rgba(0,0,0,0.035)]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>

        <Icon
          size={18}
          strokeWidth={1.8}
          className={cn(
            'shrink-0 transition-colors duration-200',
            styles.icon,
            styles.iconHover,
          )}
        />
      </div>

      <div className="mt-5">
        <div className="text-[27px] font-semibold leading-none tracking-[-0.035em] text-foreground">
          {value}
        </div>

        <div className="mt-2 text-xs leading-5 text-muted-foreground">
          {description}
        </div>
      </div>
    </article>
  )
}