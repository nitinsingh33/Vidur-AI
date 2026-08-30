import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
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

  const [summary, setSummary] =
    useState<AnalyticsSummaryResponse | null>(null)

  const [recoveryCases, setRecoveryCases] = useState<RecoveryCase[]>([])
  const [attentionCases, setAttentionCases] = useState<RecoveryCase[]>([])
  const [recentDecisions, setRecentDecisions] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function loadAnalytics() {
      try {
        setError(null)

        const [
          risk,
          recovered,
          summaryData,
          recoveryCasesData,
          criticalCases,
          escalatedCases,
          decisions,
        ] = await Promise.all([
          getRevenueAtRisk(token as string),
          getRevenueRecovered(token as string),
          getAnalyticsSummary(token as string),
          getRecoveryCases(token as string, { limit: 5 }),
          getRecoveryCases(token as string, {
            riskLevel: 'CRITICAL',
            limit: 5,
          }),
          getRecoveryCases(token as string, {
            status: 'ESCALATED',
            limit: 5,
          }),
          getAuditLog(token as string, 1, 5),
        ])

        setRevenueAtRisk(risk)
        setRevenueRecovered(recovered)
        setSummary(summaryData)
        setRecoveryCases(recoveryCasesData.data)

        const merged = [...criticalCases.data, ...escalatedCases.data]

        const unique = Array.from(
          new Map(merged.map((item) => [item.id, item])).values(),
        )
          .sort(
            (a, b) =>
              Number(b.revenueAtRisk) - Number(a.revenueAtRisk),
          )
          .slice(0, 5)

        setAttentionCases(unique)

        if (decisions) {
          setRecentDecisions(decisions.data)
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load analytics.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [token])

  const atRiskAmount = Number(revenueAtRisk?.revenueAtRisk ?? 0)
  const recoveredAmount = Number(
    revenueRecovered?.revenueRecovered ?? 0,
  )

  const totalEligible = atRiskAmount + recoveredAmount

  const recoveryRate =
    totalEligible > 0
      ? Math.round((recoveredAmount / totalEligible) * 100)
      : 0

  const overviewSubtitle =
    !loading && !error && summary && revenueAtRisk
      ? `${summary.activeRecoveryCases} active recovery ${
          summary.activeRecoveryCases === 1 ? 'case' : 'cases'
        }, ${formatAmount(
          revenueAtRisk.revenueAtRisk,
        )} at risk right now.`
      : 'Your recovery activity at a glance.'

  return (
    <section className="pb-12">
      {/* ───────────────────────── Header ───────────────────────── */}
      <header className="pt-1">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[28px]">
              {showRecoveryCases ? 'Recovery Cases' : 'Overview'}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-5 text-muted-foreground">
              {showRecoveryCases
                ? 'Review recovery cases requiring automated or human intervention.'
                : overviewSubtitle}
            </p>
          </div>

          {!showRecoveryCases && !loading && !error && (
            <button
              type="button"
              onClick={() => navigate('/recovery-cases')}
              className="w-fit shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View recovery cases →
            </button>
          )}
        </div>
      </header>

      {/* ───────────────────────── Loading ───────────────────────── */}
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
              <Skeleton className="h-36 rounded-2xl" />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────────────── Error ───────────────────────── */}
      {error && (
        <div className="mt-8 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !showRecoveryCases && (
        <>
          {/* ───────────────────────── KPI Cards ───────────────────────── */}
          <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MetricCard
              label="Revenue at risk"
              value={formatAmount(
                revenueAtRisk?.revenueAtRisk ?? 0,
              )}
              description={`${revenueAtRisk?.recoveryCases ?? 0} active recovery cases`}
              icon={ShieldAlert}
              tone="amber"
            />

            <MetricCard
              label="Revenue recovered"
              value={formatAmount(
                revenueRecovered?.revenueRecovered ?? 0,
              )}
              description={`${revenueRecovered?.successfulRecoveries ?? 0} successful recoveries`}
              icon={CircleDollarSign}
              tone="emerald"
            />

            <MetricCard
              label="Active recovery cases"
              value={String(summary?.activeRecoveryCases ?? 0)}
              description="Cases currently being managed"
              icon={Users}
              tone="primary"
            />
          </div>

          {/* ───────────────────────── Operational Status ───────────────────────── */}
          <div className="mt-4 rounded-xl border border-border bg-card px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Vidur activity
              </span>

              <div className="h-4 w-px bg-border" />

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {summary?.agentActions ?? 0}
                </span>

                <span className="text-sm text-muted-foreground">
                  actions executed
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={
                    summary?.failedActions
                      ? 'text-sm font-semibold text-destructive'
                      : 'text-sm font-semibold text-foreground'
                  }
                >
                  {summary?.failedActions ?? 0}
                </span>

                <span className="text-sm text-muted-foreground">
                  failed
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={
                    summary?.escalations
                      ? 'text-sm font-semibold text-foreground'
                      : 'text-sm font-semibold text-muted-foreground'
                  }
                >
                  {summary?.escalations ?? 0}
                </span>

                <span className="text-sm text-muted-foreground">
                  escalations
                </span>
              </div>
            </div>
          </div>

          {/* ───────────────────────── Recovery Performance ───────────────────────── */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-background to-background">
            <div className="p-6 sm:p-7">
              <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    Recovery performance
                  </p>

                  <div className="mt-1 flex items-end gap-2">
                    <strong className="font-heading text-4xl font-medium tracking-[-0.04em] text-foreground sm:text-5xl">
                      {recoveryRate}%
                    </strong>

                    <span className="pb-1.5 text-sm text-muted-foreground">
                      recovered
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatAmount(recoveredAmount)} recovered of{' '}
                    {formatAmount(totalEligible)} eligible revenue
                  </p>
                </div>

                <div className="w-full lg:max-w-sm">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Recovery rate</span>
                    <span className="font-medium text-foreground">
                      {recoveryRate}%
                    </span>
                  </div>

                  <div
                    className="h-2 overflow-hidden rounded-full bg-secondary"
                    aria-label={`Recovery rate ${recoveryRate}%`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${recoveryRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ───────────────────────── Operations ───────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Needs attention */}
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Recovery operations
                  </p>

                  <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
                    Needs attention
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/recovery-cases')}
                  className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  View all
                </button>
              </div>

              {attentionCases.length === 0 ? (
                <div className="mt-5 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No cases currently need attention.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  {attentionCases.map((recoveryCase) => (
                    <button
                      key={recoveryCase.id}
                      type="button"
                      onClick={() =>
                        navigate(
                          `/recovery-cases/${recoveryCase.id}`,
                        )
                      }
                      className="group flex w-full items-center justify-between gap-4 rounded-lg border border-border/80 px-3.5 py-3 text-left transition-colors hover:border-border hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {recoveryCase.customer?.name ?? 'Unknown customer'}
                        </div>

                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatAmount(
                            recoveryCase.revenueAtRisk,
                          )}{' '}
                          at risk
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge
                          label={recoveryCase.riskLevel}
                          tone={riskTone(
                            recoveryCase.riskLevel,
                          )}
                        />

                        <span className="text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                          →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent decisions */}
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Agent activity
                  </p>

                  <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
                    Recent decisions
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/agent-activity')}
                  className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  View all
                </button>
              </div>

              {recentDecisions.length === 0 ? (
                <div className="mt-5 flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No recent decisions
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      New recovery decisions will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 divide-y divide-border">
                  {recentDecisions.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                          <TrendingUp size={14} />
                        </div>

                        <span className="truncate text-sm font-medium text-foreground">
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

      {/* ───────────────────────── Recovery Cases ───────────────────────── */}
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