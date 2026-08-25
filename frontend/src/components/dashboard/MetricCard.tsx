import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

const toneStyles = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
  sky: 'bg-sky-500/10 text-sky-400',
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
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>

        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            toneStyles[tone],
          )}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>

      <div className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>

      <div className="mt-1.5 text-xs text-muted-foreground">
        {description}
      </div>
    </article>
  )
}
