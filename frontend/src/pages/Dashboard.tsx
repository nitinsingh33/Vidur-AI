import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bot, CircleDollarSign, ShieldAlert, TrendingUp, Users } from 'lucide-react'
import {
  getAnalyticsSummary,
  getRevenueAtRisk,
  getRevenueRecovered,
  type AnalyticsSummaryResponse,
  type RevenueAtRiskResponse,
  type RevenueRecoveredResponse,
} from '../api/analytics'
import { getRecoveryCases } from '../api/recoveryCases'
import type { RecoveryCase } from '../api/recoveryCases'
import { getAuditLog, type AuditLogEntry } from '../api/audit'
import { useAuth } from '../context/AuthContext'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RecoveryCasesTable } from '../components/recovery/RecoveryCasesTable'
import { StatusBadge } from '../components/ui/status-badge'
import { Skeleton } from '../components/ui/skeleton'
import { formatAmount, formatLabel, riskTone } from '../lib/status'

interface DashboardProps {
  showRecoveryCases?: boolean
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function Dashboard({ showRecoveryCases = false }: DashboardProps) {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [revenueAtRisk, setRevenueAtRisk] =
    useState<RevenueAtRiskResponse | null>(null)
  const [revenueRecovered, setRevenueRecovered] =
    useState<RevenueRecoveredResponse | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(
    null,
  )
  const [recoveryCases, setRecoveryCases] = useState<RecoveryCase[]>([])
  const [attentionCases, setAttentionCases] = useState<RecoveryCase[]>([])
  const [recentDecisions, setRecentDecisions] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [
          risk,
          recovered,
          summaryData,
          recoveryCasesData,
          criticalCases,
          escalatedCases,
          decisions,
        ] = await Promise.all([
          getRevenueAtRisk(),
          getRevenueRecovered(),
          getAnalyticsSummary(),
          getRecoveryCases({ limit: 5 }),
          getRecoveryCases({ riskLevel: 'CRITICAL', limit: 5 }),
          getRecoveryCases({ status: 'ESCALATED', limit: 5 }),
          token ? getAuditLog(token, 1, 5) : Promise.resolve(null),
        ])

        setRevenueAtRisk(risk)
        setRevenueRecovered(recovered)
        setSummary(summaryData)
        setRecoveryCases(recoveryCasesData.data)

        const merged = [...criticalCases.data, ...escalatedCases.data]
        const unique = Array.from(
          new Map(merged.map((item) => [item.id, item])).values(),
        )
          .sort((a, b) => Number(b.revenueAtRisk) - Number(a.revenueAtRisk))
          .slice(0, 5)
        setAttentionCases(unique)

        if (decisions) setRecentDecisions(decisions.data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load analytics.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [token])

  const atRiskAmount = Number(revenueAtRisk?.revenueAtRisk ?? 0)
  const recoveredAmount = Number(revenueRecovered?.revenueRecovered ?? 0)
  const totalEligible = atRiskAmount + recoveredAmount
  const recoveryRate =
    totalEligible > 0 ? Math.round((recoveredAmount / totalEligible) * 100) : 0

  const overviewSubtitle =
    !loading && !error && summary && revenueAtRisk
      ? `${summary.activeRecoveryCases} active recovery ${summary.activeRecoveryCases === 1 ? 'case' : 'cases'}, ${formatAmount(revenueAtRisk.revenueAtRisk)} at risk right now.`
      : 'Monitor revenue recovery and agent activity in real time.'

  return (
    <section className="pb-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Recovery intelligence
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          {showRecoveryCases ? 'Recovery Cases' : 'Overview'}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          {showRecoveryCases
            ? 'Review recovery cases requiring automated or human intervention.'
            : overviewSubtitle}
        </p>
      </div>

      {loading && (
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          {!showRecoveryCases && (
            <>
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !showRecoveryCases && (
        <>
          {/* Primary KPIs */}
          <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MetricCard
              label="Revenue At Risk"
              value={formatAmount(revenueAtRisk?.revenueAtRisk ?? 0)}
              description={`${revenueAtRisk?.recoveryCases ?? 0} active recovery cases`}
              icon={ShieldAlert}
              tone="amber"
            />

            <MetricCard
              label="Revenue Recovered"
              value={formatAmount(revenueRecovered?.revenueRecovered ?? 0)}
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
          </div>

          {/* Secondary operational signals */}
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card/60 px-5 py-3.5">
            {[
              { label: 'Agent actions', value: summary?.agentActions ?? 0, icon: Bot },
              { label: 'Failed actions', value: summary?.failedActions ?? 0, icon: AlertTriangle },
              { label: 'Escalations', value: summary?.escalations ?? 0, icon: TrendingUp },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <stat.icon size={15} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Recovery performance */}
          <div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-6">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Recovery performance
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
            <p className="mt-4 text-[11px] text-muted-foreground">
              Aggregate to date. Day-by-day trend requires time-series data
              not yet exposed by the API.
            </p>
          </div>

          {/* Needs attention + Recent AI decisions */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recovery operations
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">
                    Needs attention
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/recovery-cases')}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  View all
                </button>
              </div>

              {attentionCases.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No cases currently need attention.
                </p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {attentionCases.map((recoveryCase) => (
                    <button
                      key={recoveryCase.id}
                      type="button"
                      onClick={() =>
                        navigate(`/recovery-cases/${recoveryCase.id}`)
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {recoveryCase.customer.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAmount(recoveryCase.revenueAtRisk)} at risk
                        </div>
                      </div>
                      <StatusBadge
                        label={recoveryCase.riskLevel}
                        tone={riskTone(recoveryCase.riskLevel)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recovery intelligence
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">
                    Recent AI decisions
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/agent-activity')}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  View all
                </button>
              </div>

              {recentDecisions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Vidur AI hasn't recorded any decisions yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentDecisions.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                          <Bot size={14} />
                        </div>
                        <span className="truncate font-medium text-foreground">
                          {formatLabel(entry.action)}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(entry.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !error && (
        <div className="mt-6">
          <RecoveryCasesTable
            cases={recoveryCases}
            onOpenRecoveryCase={(recoveryCaseId) =>
              navigate(`/recovery-cases/${recoveryCaseId}`)
            }
          />
        </div>
      )}
    </section>
  )
}
