import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { getRecoveryCases } from '../api/recoveryCases'
import type { RecoveryCase } from '../api/recoveryCases'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RecoveryCasesTable } from '../components/recovery/RecoveryCasesTable'
import { Skeleton } from '../components/ui/skeleton'
import { formatAmount } from '../lib/status'

interface DashboardProps {
  showRecoveryCases?: boolean
}

export function Dashboard({ showRecoveryCases = false }: DashboardProps) {
  const navigate = useNavigate()

  const [revenueAtRisk, setRevenueAtRisk] =
    useState<RevenueAtRiskResponse | null>(null)
  const [revenueRecovered, setRevenueRecovered] =
    useState<RevenueRecoveredResponse | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(
    null,
  )
  const [recoveryCases, setRecoveryCases] = useState<RecoveryCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [risk, recovered, summaryData, recoveryCasesData] =
          await Promise.all([
            getRevenueAtRisk(),
            getRevenueRecovered(),
            getAnalyticsSummary(),
            getRecoveryCases(1, 5),
          ])

        setRevenueAtRisk(risk)
        setRevenueRecovered(recovered)
        setSummary(summaryData)
        setRecoveryCases(recoveryCasesData.data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load analytics.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

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
            : 'Monitor revenue recovery and agent activity in real time.'}
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

      {!loading && !error && !showRecoveryCases && (
        <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
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
