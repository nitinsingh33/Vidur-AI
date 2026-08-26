import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bot,
  Search,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { StatusBadge } from '../ui/status-badge'

const steps = [
  {
    key: 'failure',
    icon: AlertTriangle,
    label: 'Payment failed',
    value: '₹12,499 at risk',
    valueClassName: 'text-foreground',
  },
  {
    key: 'reason',
    icon: Search,
    label: 'Failure reason',
    value: 'Insufficient funds',
    valueClassName: 'text-foreground',
  },
  {
    key: 'probability',
    icon: TrendingUp,
    label: 'Recovery probability',
    value: '68%',
    valueClassName: 'text-foreground',
    progress: 68,
  },
  {
    key: 'recommendation',
    icon: Bot,
    label: 'Vidur AI recommendation',
    value: 'Retry after balance refresh',
    valueClassName: 'text-foreground',
  },
  {
    key: 'policy',
    icon: ShieldCheck,
    label: 'Policy check',
    badge: { label: 'ALLOW', tone: 'emerald' as const },
  },
  {
    key: 'action',
    icon: Zap,
    label: 'Recovery action',
    badge: { label: 'SCHEDULED', tone: 'sky' as const },
  },
]

export function HeroRecoveryCard() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recovery case
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          Deciding
        </span>
      </div>

      <div className="p-5">
        {steps.map((step, index) => (
          <motion.div
            key={step.key}
            className="relative flex gap-3.5 pb-5 last:pb-0"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15 + index * 0.1 }}
          >
            {index < steps.length - 1 && (
              <span className="absolute left-4 top-9 bottom-0 w-px bg-border" />
            )}

            <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <step.icon size={15} />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {step.label}
                </span>
                {step.badge && (
                  <StatusBadge label={step.badge.label} tone={step.badge.tone} />
                )}
              </div>

              {step.value && (
                <strong
                  className={`mt-0.5 block text-sm font-semibold ${step.valueClassName}`}
                >
                  {step.value}
                </strong>
              )}

              {step.progress !== undefined && (
                <div className="mt-2 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${step.progress}%` }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-3">
        <span className="text-[11px] text-muted-foreground">
          Illustrative example — not live transaction data.
        </span>
      </div>
    </div>
  )
}
