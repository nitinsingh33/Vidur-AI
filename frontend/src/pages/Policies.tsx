import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getPolicies, type Policy } from '../api/policies'
import { Skeleton } from '../components/ui/skeleton'
import { StatusBadge } from '../components/ui/status-badge'
import { useAuth } from '../context/AuthContext'
import { formatAmount, formatLabel, policyTone } from '../lib/status'

export function Policies() {
  const { token } = useAuth()

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await getPolicies(token as string)
        setPolicies(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load policies.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  return (
    <section className="pb-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Recovery intelligence
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          Policies
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          The guardrails Vidur checks every recovery action against before it
          executes.
        </p>
      </div>

      {loading && (
        <div className="mt-8 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && policies.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck size={18} />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No policies configured yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Without a policy for an action type, Vidur blocks it by default
            until one is added.
          </p>
        </div>
      )}

      {!loading && !error && policies.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {policies.map((policy) => (
            <article
              key={policy.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-sm font-semibold text-foreground">
                    {policy.name}
                  </strong>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatLabel(policy.actionType)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge
                    label={policy.decision}
                    tone={policyTone(policy.decision)}
                  />
                  <StatusBadge
                    label={policy.enabled ? 'ENABLED' : 'DISABLED'}
                    tone={policy.enabled ? 'emerald' : 'neutral'}
                  />
                </div>
              </div>

              {policy.description && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {policy.description}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3.5">
                <div>
                  <dt className="text-[11px] text-muted-foreground">
                    Max retries
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {policy.maxRetries ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">
                    Max contacts
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {policy.maxContacts ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">
                    Max amount
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {policy.maxAmount ? formatAmount(policy.maxAmount) : '—'}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
