import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  getPolicies,
  syncDefaultPolicies,
  updatePolicy,
  type Policy,
} from '../api/policies'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { StatusBadge } from '../components/ui/status-badge'
import { useAuth } from '../context/AuthContext'
import { formatAmount, formatLabel, policyTone } from '../lib/status'

const DECISIONS = ['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL'] as const

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function Policies() {
  const { token, user } = useAuth()
  const canEdit = user?.role === 'ADMIN'

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

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

  async function applyUpdate(
    policyId: string,
    updates: Parameters<typeof updatePolicy>[2],
  ) {
    if (!token) return

    try {
      setSavingId(policyId)
      setError(null)
      const updated = await updatePolicy(token, policyId, updates)
      setPolicies((current) =>
        current.map((policy) => (policy.id === policyId ? updated : policy)),
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update the policy.',
      )
    } finally {
      setSavingId(null)
    }
  }

  async function handleSyncDefaults() {
    if (!token) return

    try {
      setSyncing(true)
      setSyncMessage(null)
      setError(null)
      const result = await syncDefaultPolicies(token)
      if (result.created.length > 0) {
        setSyncMessage(
          `Added ${result.created.length} new policy${result.created.length === 1 ? '' : 'ies'}: ${result.created.map(formatLabel).join(', ')}.`,
        )
        const data = await getPolicies(token)
        setPolicies(data)
      } else {
        setSyncMessage('Already up to date — no new policies to add.')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sync default policies.',
      )
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="pb-12">
      <header className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-3">
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

          {canEdit && !loading && (
            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncDefaults}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/40 disabled:opacity-60"
            >
              {syncing ? 'Syncing…' : 'Sync new default policies'}
            </button>
          )}
        </div>

        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Merchant policy controls the actions Vidur is allowed to take
          during recovery — every limit below is yours to set. There is no
          fixed or provider-mandated value; these are your configured
          defaults, editable at any time.
        </p>

        {syncMessage && (
          <p className="mt-2 text-xs text-muted-foreground">{syncMessage}</p>
        )}
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
            const saving = savingId === policy.id

            return (
              <article
                key={policy.id}
                className={`px-4 py-4 sm:px-5 ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        {policy.name}
                      </h2>

                      {canEdit ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            applyUpdate(policy.id, { enabled: !policy.enabled })
                          }
                          className="disabled:opacity-60"
                        >
                          <StatusBadge
                            label={policy.enabled ? 'Enabled' : 'Disabled'}
                            tone={policy.enabled ? 'emerald' : 'neutral'}
                          />
                        </button>
                      ) : (
                        <StatusBadge
                          label={policy.enabled ? 'Enabled' : 'Disabled'}
                          tone={policy.enabled ? 'emerald' : 'neutral'}
                        />
                      )}
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

                  {canEdit ? (
                    <select
                      className="h-8 shrink-0 rounded-lg border border-border bg-card px-2 text-xs font-medium text-foreground disabled:opacity-60"
                      value={policy.decision}
                      disabled={saving}
                      onChange={(event) =>
                        applyUpdate(policy.id, { decision: event.target.value })
                      }
                    >
                      {DECISIONS.map((decision) => (
                        <option key={decision} value={decision}>
                          {formatLabel(decision)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge
                      label={policy.decision}
                      tone={policyTone(policy.decision)}
                    />
                  )}
                </div>

                {canEdit ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Max retries
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1 h-7 text-xs"
                        disabled={saving}
                        defaultValue={policy.maxRetries ?? ''}
                        placeholder="No limit"
                        onBlur={(event) =>
                          applyUpdate(policy.id, {
                            maxRetries: toNullableNumber(event.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Retry interval (min)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1 h-7 text-xs"
                        disabled={saving}
                        defaultValue={policy.retryIntervalMinutes ?? ''}
                        placeholder="No minimum"
                        onBlur={(event) =>
                          applyUpdate(policy.id, {
                            retryIntervalMinutes: toNullableNumber(
                              event.target.value,
                            ),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Max contacts
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        className="mt-1 h-7 text-xs"
                        disabled={saving}
                        defaultValue={policy.maxContacts ?? ''}
                        placeholder="No limit"
                        onBlur={(event) =>
                          applyUpdate(policy.id, {
                            maxContacts: toNullableNumber(event.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Max amount (₹)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 h-7 text-xs"
                        disabled={saving}
                        defaultValue={policy.maxAmount ?? ''}
                        placeholder="No limit"
                        onBlur={(event) =>
                          applyUpdate(policy.id, {
                            maxAmount: toNullableNumber(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3">
                    {policy.maxRetries !== null && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Max retries
                        </span>
                        <span className="font-medium text-foreground">
                          {policy.maxRetries}
                        </span>
                      </div>
                    )}
                    {policy.retryIntervalMinutes !== null && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Retry interval
                        </span>
                        <span className="font-medium text-foreground">
                          {policy.retryIntervalMinutes} min
                        </span>
                      </div>
                    )}
                    {policy.maxContacts !== null && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Max contacts
                        </span>
                        <span className="font-medium text-foreground">
                          {policy.maxContacts}
                        </span>
                      </div>
                    )}
                    {policy.maxAmount && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">
                          Max amount
                        </span>
                        <span className="font-medium text-foreground">
                          {formatAmount(policy.maxAmount)}
                        </span>
                      </div>
                    )}
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
