import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  Mail,
  Phone,
  UserRound,
  XCircle,
} from "lucide-react";
import { getRecoveryCase, type RecoveryCase } from "../api/recoveryCases";
import { getCaseAuditTrail, type AuditLogEntry } from "../api/audit";
import { VidurRecoveryPanel } from "../components/recovery/VidurRecoveryPanel";
import { AgentAuditTrail } from "../components/recovery/AgentAuditTrail";
import { AgentReasoningCard } from "../components/recovery/AgentReasoningCard";
import { StatusBadge } from "../components/ui/status-badge";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import {
  actionStatusTone,
  caseStatusTone,
  formatAmount,
  formatLabel,
  policyTone,
  riskTone,
} from "../lib/status";

function getActionIcon(status: string) {
  if (status === "SUCCESS") return <CheckCircle2 size={15} />;
  if (status === "FAILED") return <XCircle size={15} />;
  return <Clock3 size={15} />;
}

export function RecoveryCaseDetails() {
  const { recoveryCaseId } = useParams<{ recoveryCaseId: string }>();

  const navigate = useNavigate();
  const { token } = useAuth();

  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);

  const [auditTrail, setAuditTrail] = useState<AuditLogEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    // Narrow into a local const: `token` is `string | null` on the outer
    // scope, and TypeScript doesn't carry the `if (!token) return` guard's
    // narrowing into this nested function.
    const authToken = token;

    async function loadCase() {
      try {
        setLoading(true);
        setError(null);

        if (!recoveryCaseId) return;

        const [data, events] = await Promise.all([
          getRecoveryCase(authToken, recoveryCaseId),
          getCaseAuditTrail(authToken, recoveryCaseId),
        ]);

        setRecoveryCase(data);
        setAuditTrail(events);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load recovery case.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadCase();
  }, [recoveryCaseId, token]);

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl pb-12">
        <Skeleton className="mb-5 h-5 w-40" />
        <Skeleton className="h-9 w-72" />

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>

        <Skeleton className="mt-5 h-48 rounded-2xl" />
      </section>
    );
  }

  if (error || !recoveryCase) {
    return (
      <section className="mx-auto max-w-6xl pb-12">
        <button
          type="button"
          onClick={() => navigate("/recovery-cases")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={16} />
          Back to recovery cases
        </button>

        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          {error ?? "Recovery case not found."}
        </div>
      </section>
    );
  }

  const probability = Math.round(
    Number(recoveryCase.recoveryProbability) * 100,
  );

  return (
    <section className="mx-auto max-w-6xl pb-14">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate("/recovery-cases")}
        className="group mb-6 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-card transition-colors group-hover:bg-secondary">
          <ArrowLeft size={14} />
        </span>
        Recovery cases
      </button>

      {/* Header */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-primary">
              Recovery case
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Case details
          </h1>

          <p className="mt-1.5 max-w-full truncate font-mono text-[11px] text-muted-foreground">
            {recoveryCase.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={recoveryCase.status}
            tone={caseStatusTone(recoveryCase.status)}
          />

          <StatusBadge
            label={`${formatLabel(recoveryCase.riskLevel)} risk`}
            tone={riskTone(recoveryCase.riskLevel)}
          />
        </div>
      </header>

      {/* Metrics */}
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="absolute right-0 top-0 size-24 rounded-full bg-primary/[0.04] blur-2xl" />

          <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Revenue at risk
          </p>

          <p className="relative mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {formatAmount(recoveryCase.revenueAtRisk)}
          </p>

          <p className="relative mt-1 text-xs text-muted-foreground">
            Capital currently exposed
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Recovery probability
          </p>

          <div className="mt-3 flex items-end gap-3">
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {probability}%
            </p>

            <span className="mb-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
              Estimated
            </span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(probability, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Root cause
          </p>

          <p className="mt-3 text-lg font-semibold text-foreground">
            {formatLabel(recoveryCase.rootCause)}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Identified from payment failure data
          </p>
        </div>
      </div>

      {/* AI */}
      <AgentReasoningCard recoveryCase={recoveryCase} />

      {/* Agent */}
      <VidurRecoveryPanel
        recoveryCase={recoveryCase}
        onCompleted={() => window.location.reload()}
      />

      {/* Customer + payment */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                <UserRound size={15} className="text-muted-foreground" />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Customer
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-foreground">
                  Customer information
                </h2>
              </div>
            </div>
          </header>

          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between gap-5 px-5 py-4">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserRound size={13} />
                Name
              </dt>
              <dd className="text-right text-sm font-medium text-foreground">
                {recoveryCase.customer.name}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-5 px-5 py-4">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail size={13} />
                Email
              </dt>
              <dd className="max-w-[65%] truncate text-right text-sm font-medium text-foreground">
                {recoveryCase.customer.email}
              </dd>
            </div>

            {recoveryCase.customer.phone && (
              <div className="flex items-center justify-between gap-5 px-5 py-4">
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone size={13} />
                  Phone
                </dt>
                <dd className="text-right text-sm font-medium text-foreground">
                  {recoveryCase.customer.phone}
                </dd>
              </div>
            )}
          </dl>
        </article>

        <article className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                <CreditCard size={15} className="text-muted-foreground" />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Payment
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-foreground">
                  Payment information
                </h2>
              </div>
            </div>
          </header>

          {recoveryCase.payment ? (
            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between gap-5 px-5 py-3.5">
                <dt className="text-xs text-muted-foreground">Amount</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {formatAmount(
                    recoveryCase.payment.amount,
                    recoveryCase.payment.currency,
                  )}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-5 px-5 py-3.5">
                <dt className="text-xs text-muted-foreground">Method</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatLabel(recoveryCase.payment.method)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-5 px-5 py-3.5">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatLabel(recoveryCase.payment.status)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-5 px-5 py-3.5">
                <dt className="text-xs text-muted-foreground">
                  Failure reason
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatLabel(recoveryCase.payment.failureReason)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-5 px-5 py-3.5">
                <dt className="text-xs text-muted-foreground">Attempt</dt>
                <dd className="font-mono text-xs font-medium text-foreground">
                  #{recoveryCase.payment.attemptNumber}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No payment information available.
            </p>
          )}
        </article>
      </div>

      {/* Recovery actions */}
      <article className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <header className="border-b border-border px-5 py-4 sm:px-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Agent activity
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-foreground">
            Recovery actions
          </h2>
        </header>

        <div className="p-5 sm:p-6">
          {recoveryCase.actions.length > 0 ? (
            <div className="space-y-0">
              {recoveryCase.actions.map((action, index) => (
                <div
                  key={action.id}
                  className="relative flex gap-4 pb-7 last:pb-0">
                  {index < recoveryCase.actions.length - 1 && (
                    <span className="absolute left-4 top-9 bottom-0 w-px bg-border" />
                  )}

                  <div
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card",
                      action.status === "SUCCESS"
                        ? "border-emerald-500/20 text-emerald-500"
                        : action.status === "FAILED"
                          ? "border-destructive/20 text-destructive"
                          : "border-border text-muted-foreground",
                    )}>
                    {getActionIcon(action.status)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-semibold text-foreground">
                        {formatLabel(action.type)}
                      </strong>

                      <StatusBadge
                        label={action.status}
                        tone={actionStatusTone(action.status)}
                      />
                    </div>

                    {action.reason && (
                      <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                        {action.reason}
                      </p>
                    )}

                    {action.policyDecision && (
                      <StatusBadge
                        className="mt-2"
                        label={`Policy: ${formatLabel(action.policyDecision)}`}
                        tone={policyTone(action.policyDecision)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20">
              <p className="text-sm text-muted-foreground">
                No recovery actions recorded yet.
              </p>
            </div>
          )}
        </div>
      </article>

      {/* Outcome */}
      {recoveryCase.outcome && (
        <article
          className={cn(
            "mt-4 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
            recoveryCase.outcome.successful
              ? "border-emerald-500/20 bg-emerald-500/[0.05]"
              : "border-border bg-card",
          )}>
          <div>
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                recoveryCase.outcome.successful
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}>
              Recovery outcome
            </p>

            <h2 className="mt-1 text-base font-semibold text-foreground">
              {recoveryCase.outcome.successful
                ? "Revenue recovered"
                : "Recovery unsuccessful"}
            </h2>
          </div>

          <strong className="text-2xl font-semibold tracking-tight text-foreground">
            {formatAmount(recoveryCase.outcome.recoveredAmount)}
          </strong>
        </article>
      )}

      {/* Compliance */}
      <AgentAuditTrail entries={auditTrail} />
    </section>
  );
}
