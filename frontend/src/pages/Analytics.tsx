import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CircleDollarSign,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  getAnalyticsSummary,
  getRevenueAtRisk,
  getRevenueRecovered,
  type AnalyticsSummaryResponse,
  type RevenueAtRiskResponse,
  type RevenueRecoveredResponse,
} from '../api/analytics'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Skeleton } from '../components/ui/skeleton'
import { formatAmount } from '../lib/status'

export function Analytics() {
  const [revenueAtRisk, setRevenueAtRisk] =
    useState<RevenueAtRiskResponse | null>(null)
  const [revenueRecovered, setRevenueRecovered] =
    useState<RevenueRecoveredResponse | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [risk, recovered, summaryData] = await Promise.all([
          getRevenueAtRisk(),
          getRevenueRecovered(),
          getAnalyticsSummary(),
        ])

        setRevenueAtRisk(risk)
        setRevenueRecovered(recovered)
        setSummary(summaryData)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load analytics.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const atRiskAmount = Number(revenueAtRisk?.revenueAtRisk ?? 0)
  const recoveredAmount = Number(revenueRecovered?.revenueRecovered ?? 0)
  const totalEligible = atRiskAmount + recoveredAmount
  const recoveryRate =
    totalEligible > 0 ? Math.round((recoveredAmount / totalEligible) * 100) : 0

  return (
    <section className="pb-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Recovery intelligence
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          How much revenue is at risk, how much Vidur has recovered, and how
          the agent is performing across every recovery case.
        </p>
      </div>

      {loading && (
        <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Recovery rate
                </span>
                <strong className="mt-1.5 block font-heading text-4xl font-medium tracking-tight text-foreground">
                  {recoveryRate}%
                </strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatAmount(recoveredAmount)} recovered of{' '}
                  {formatAmount(totalEligible)} eligible revenue
                </p>
              </div>

              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-secondary sm:w-64">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${recoveryRate}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Revenue At Risk"
              value={formatAmount(atRiskAmount)}
              description={`${revenueAtRisk?.recoveryCases ?? 0} active recovery cases`}
              icon={ShieldAlert}
              tone="amber"
            />

            <MetricCard
              label="Revenue Recovered"
              value={formatAmount(recoveredAmount)}
              description={`${revenueRecovered?.successfulRecoveries ?? 0} successful recoveries`}
              icon={CircleDollarSign}
              tone="emerald"
            />

            <MetricCard
              label="Active Recovery Cases"
              value={String(summary?.activeRecoveryCases ?? 0)}
              description="Cases currently being managed"
              icon={Users}
              tone="primary"
            />

            <MetricCard
              label="Agent Actions"
              value={String(summary?.agentActions ?? 0)}
              description="Recovery actions recorded"
              icon={Bot}
              tone="sky"
            />

            <MetricCard
              label="Failed Actions"
              value={String(summary?.failedActions ?? 0)}
              description="Actions requiring attention"
              icon={AlertTriangle}
              tone="rose"
            />

            <MetricCard
              label="Escalations"
              value={String(summary?.escalations ?? 0)}
              description="Cases requiring human review"
              icon={TrendingUp}
              tone="amber"
            />
          </div>
        </>
      )}
    </section>
  )
}
