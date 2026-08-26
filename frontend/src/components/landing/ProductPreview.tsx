import { CircleDollarSign, ShieldAlert, Users } from 'lucide-react'
import { MetricCard } from '../dashboard/MetricCard'
import { StatusBadge } from '../ui/status-badge'
import type { Tone } from '../../lib/status'

const timeline: Array<{ title: string; reason: string; tone: Tone; status: string }> = [
  {
    title: 'AI Diagnosis',
    reason: 'Insufficient funds identified from payment context',
    tone: 'emerald',
    status: 'SUCCESS',
  },
  {
    title: 'Policy Check',
    reason: 'Within retry limit for this customer',
    tone: 'emerald',
    status: 'ALLOW',
  },
  {
    title: 'Retry Payment',
    reason: 'Scheduled in 2 hours',
    tone: 'amber',
    status: 'PENDING',
  },
]

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Vidur AI — Recovery Dashboard
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Preview
        </span>
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <MetricCard
            label="Revenue At Risk"
            value="₹18,42,300"
            description="32 active recovery cases"
            icon={ShieldAlert}
            tone="amber"
          />
          <MetricCard
            label="Revenue Recovered"
            value="₹1,12,84,650"
            description="164 successful recoveries"
            icon={CircleDollarSign}
            tone="emerald"
          />
          <MetricCard
            label="Active Recovery Cases"
            value="32"
            description="Cases currently being managed"
            icon={Users}
            tone="primary"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.5fr]">
          <div className="rounded-xl border border-border p-4">
            <span className="text-xs text-muted-foreground">
              Recovery probability
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <strong className="text-2xl font-semibold text-foreground">
                68%
              </strong>
              <span className="text-xs text-muted-foreground">
                Case #RC-2298
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: '68%' }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <span className="text-xs text-muted-foreground">
              Recovery timeline
            </span>
            <div className="mt-3 space-y-3">
              {timeline.map((entry) => (
                <div
                  key={entry.title}
                  className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <strong className="block text-sm font-medium text-foreground">
                      {entry.title}
                    </strong>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.reason}
                    </span>
                  </div>
                  <StatusBadge label={entry.status} tone={entry.tone} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
