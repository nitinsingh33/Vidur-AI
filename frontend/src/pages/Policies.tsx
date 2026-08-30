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
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Policies
            </h1>
          </div>
        </div>

        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Control the actions Vidur is allowed to take during recovery.
        </p>
      </header>

      {loading && (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px] rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && policies.length === 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck size={18} />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No policies configured
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vidur blocks actions by default when no policy exists.
          </p>
        </div>
      )}

      {!loading && !error && policies.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          {policies.map((policy, index) => {
            const limits = [
              policy.maxRetries !== null && policy.maxRetries !== undefined
                ? { label: 'Retries', value: policy.maxRetries }
                : null,
              policy.maxContacts !== null &&
              policy.maxContacts !== undefined
                ? { label: 'Contacts', value: policy.maxContacts }
                : null,
              policy.maxAmount
                ? { label: 'Max amount', value: formatAmount(policy.maxAmount) }
                : null,
            ].filter(Boolean) as { label: string; value: string | number }[]

            return (
              <article
                key={policy.id}
                className={`px-4 py-4 sm:px-5 ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        {policy.name}
                      </h2>

                      <StatusBadge
                        label={policy.enabled ? 'Enabled' : 'Disabled'}
                        tone={policy.enabled ? 'emerald' : 'neutral'}
                      />
                    </div>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatLabel(policy.actionType)}
                    </p>

                    {policy.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {policy.description}
                      </p>
                    )}
                  </div>

                  <StatusBadge
                    label={policy.decision}
                    tone={policyTone(policy.decision)}
                  />
                </div>

                {limits.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
                    {limits.map((limit) => (
                      <div
                        key={limit.label}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {limit.label}
                        </span>
                        <span className="font-medium text-foreground">
                          {limit.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
