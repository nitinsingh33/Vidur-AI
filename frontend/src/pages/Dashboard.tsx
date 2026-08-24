import "./Dashboard.css";
import { useEffect, useState } from "react";
import {
  getAnalyticsSummary,
  getRevenueAtRisk,
  getRevenueRecovered,
  type AnalyticsSummaryResponse,
  type RevenueAtRiskResponse,
  type RevenueRecoveredResponse,
} from "../api/analytics";
import { getRecoveryCases } from "../api/recoveryCases";
import type { RecoveryCase } from "../api/recoveryCases";
import { MetricCard } from "../components/dashboard/MetricCard";
import { RecoveryCasesTable } from "../components/recovery/RecoveryCasesTable";

interface DashboardProps {
  showRecoveryCases: boolean;
  onOpenRecoveryCase: (recoveryCaseId: string) => void;
}

export function Dashboard({
  showRecoveryCases,
  onOpenRecoveryCase,
}: DashboardProps) {
  const [revenueAtRisk, setRevenueAtRisk] =
    useState<RevenueAtRiskResponse | null>(null);

  const [revenueRecovered, setRevenueRecovered] =
    useState<RevenueRecoveredResponse | null>(null);

  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);

  const [recoveryCases, setRecoveryCases] = useState<RecoveryCase[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const [risk, recovered, summaryData, recoveryCasesData] =
          await Promise.all([
            getRevenueAtRisk(),
            getRevenueRecovered(),
            getAnalyticsSummary(),
            getRecoveryCases(1, 5),
          ]);

        setRevenueAtRisk(risk);
        setRevenueRecovered(recovered);
        setSummary(summaryData);
        setRecoveryCases(recoveryCasesData.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load analytics.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Recovery intelligence</p>

          <h1>{showRecoveryCases ? "Recovery Cases" : "Overview"}</h1>

          <p className="page-description">
            {showRecoveryCases
              ? "Review recovery cases requiring automated or human intervention."
              : "Monitor revenue recovery and agent activity in real time."}
          </p>
        </div>
      </div>

      {loading && (
        <div className="dashboard-state">Loading recovery analytics...</div>
      )}

      {error && <div className="dashboard-state error">{error}</div>}

      {!loading && !error && !showRecoveryCases && (
        <div className="metrics-grid">
          <MetricCard
            label="Revenue At Risk"
            value={`₹${Number(revenueAtRisk?.revenueAtRisk ?? 0).toLocaleString(
              "en-IN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}`}
            description={`${revenueAtRisk?.recoveryCases ?? 0} active recovery cases`}
          />

          <MetricCard
            label="Revenue Recovered"
            value={`₹${Number(
              revenueRecovered?.revenueRecovered ?? 0,
            ).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            description={`${revenueRecovered?.successfulRecoveries ?? 0} successful recoveries`}
          />

          <MetricCard
            label="Active Recovery Cases"
            value={String(summary?.activeRecoveryCases ?? 0)}
            description="Cases currently being managed"
          />

          <MetricCard
            label="Agent Actions"
            value={String(summary?.agentActions ?? 0)}
            description="Recovery actions recorded"
          />

          <MetricCard
            label="Failed Actions"
            value={String(summary?.failedActions ?? 0)}
            description="Actions requiring attention"
          />

          <MetricCard
            label="Escalations"
            value={String(summary?.escalations ?? 0)}
            description="Cases requiring human review"
          />
        </div>
      )}

      {!loading && !error && (
        <RecoveryCasesTable
          cases={recoveryCases}
          onOpenRecoveryCase={onOpenRecoveryCase}
        />
      )}
    </section>
  );
}
