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
  getPaymentHealth,
  getRevenueAtRisk,
  getRevenueRecovered,
  type AnalyticsSummaryResponse,
  type PaymentHealthResponse,
  type RevenueAtRiskResponse,
  type RevenueRecoveredResponse,
} from '../api/analytics'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Skeleton } from '../components/ui/skeleton'
import { formatAmount } from '../lib/status'
import { useAuth } from '../context/AuthContext'

export function Analytics() {
  const { token } = useAuth()

  const [revenueAtRisk, setRevenueAtRisk] =
    useState<RevenueAtRiskResponse | null>(null)
  const [revenueRecovered, setRevenueRecovered] =
    useState<RevenueRecoveredResponse | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(
    null,
  )
  const [paymentHealth, setPaymentHealth] =
    useState<PaymentHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        const [risk, recovered, summaryData, health] = await Promise.all([
          getRevenueAtRisk(token as string),
          getRevenueRecovered(token as string),
          getAnalyticsSummary(token as string),
          getPaymentHealth(token as string),
        ])

        setRevenueAtRisk(risk)
        setRevenueRecovered(recovered)
        setSummary(summaryData)
        setPaymentHealth(health)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load analytics.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

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

          {paymentHealth && <PaymentDegradationSection health={paymentHealth} />}
        </>
      )}
    </section>
  )
}

function PaymentDegradationSection({ health }: { health: PaymentHealthResponse }) {
  const currentRate = health.currentWindowSuccessRate
  const previousRate = health.previousWindowSuccessRate
  const delta =
    currentRate !== null && previousRate !== null
      ? Math.round((currentRate - previousRate) * 1000) / 10
      : null

  const maxDailyVolume = Math.max(
    1,
    ...health.daily.map((day) => day.captured + day.failed),
  )

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Payment degradation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Computed live from the last {health.windowDays} days of real
            payment history — no predefined incidents.
          </p>
        </div>

        {delta !== null && (
          <div
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              delta >= 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {delta} pts vs previous window
          </div>
        )}
      </div>

      {health.daily.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Not enough payment history yet to chart a trend.
        </p>
      ) : (
        <div className="mt-6 flex h-32 items-end gap-1">
          {health.daily.map((day) => {
            const volume = day.captured + day.failed
            const heightPct = Math.max(4, (volume / maxDailyVolume) * 100)
            const successRatePct =
              day.successRate === null ? null : Math.round(day.successRate * 100)

            return (
              <div
                key={day.date}
                className="group relative flex-1"
                title={`${day.date}: ${day.captured} captured, ${day.failed} failed${
                  successRatePct !== null ? ` (${successRatePct}% success)` : ''
                }`}
              >
                <div
                  className="w-full rounded-t-sm bg-secondary transition-colors group-hover:bg-primary/60"
                  style={{ height: `${heightPct}%` }}
                >
                  {volume > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-rose-500/60"
                      style={{
                        height: `${(day.failed / volume) * 100}%`,
                        marginTop: `${(day.captured / volume) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Top failure reasons
          </h3>
          {health.failureReasons.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No failed payments in this window.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {health.failureReasons.map((reason) => (
                <li
                  key={reason.reason}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{reason.reason}</span>
                  <span className="font-medium text-foreground">
                    {reason.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">By payment method</h3>
          {health.byMethod.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No payment data in this window.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {health.byMethod.map((method) => (
                <li
                  key={method.method}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{method.method}</span>
                  <span className="font-medium text-foreground">
                    {method.successRate === null
                      ? '—'
                      : `${Math.round(method.successRate * 100)}%`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
