import { useEffect, useMemo, useState } from 'react'
import { Loader2, MoreHorizontal, ShieldCheck } from 'lucide-react'
import {
  getPolicies,
  syncDefaultPolicies,
  updatePolicy,
  type Policy,
  type UpdatePolicyPayload,
} from '../api/policies'
import { PolicyCard } from '../components/policies/PolicyCard'
import { ConfigurePolicyDrawer } from '../components/policies/ConfigurePolicyDrawer'
import { Skeleton } from '../components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { useAuth } from '../context/AuthContext'
import { formatLabel } from '../lib/status'
import { POLICY_GROUPS, getPolicyGroup } from '../lib/policyLabels'

export function Policies() {
  const { token, user } = useAuth()
  const canEdit = user?.role === 'ADMIN'

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // `configuringPolicy` deliberately isn't cleared on close — only
  // `drawerOpen` flips to false — so the drawer's own closing transition has
  // real content to animate out instead of vanishing instantly.
  // `drawerSession` increments on every "Configure" click and is used as
  // part of the drawer's `key`, so it always remounts with a fresh copy of
  // the policy even if the same one is reopened after a cancelled edit.
  const [configuringPolicy, setConfiguringPolicy] = useState<Policy | null>(
    null,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSession, setDrawerSession] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const groupedPolicies = useMemo(() => {
    return POLICY_GROUPS.map((group) => ({
      ...group,
      policies: policies.filter((policy) => getPolicyGroup(policy) === group.id),
    })).filter((group) => group.policies.length > 0)
  }, [policies])

  function handleConfigure(policy: Policy) {
    setConfiguringPolicy(policy)
    setDrawerOpen(true)
    setDrawerSession((session) => session + 1)
  }

  async function handleSave(policyId: string, updates: UpdatePolicyPayload) {
    if (!token) return

    try {
      setSaving(true)
      setSaveError(null)
      const updated = await updatePolicy(token, policyId, updates)
      setPolicies((current) =>
        current.map((policy) => (policy.id === policyId ? updated : policy)),
      )
      setDrawerOpen(false)
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Unable to update the policy.',
      )
    } finally {
      setSaving(false)
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
          `Added ${result.created.length} new polic${result.created.length === 1 ? 'y' : 'ies'}: ${result.created.map(formatLabel).join(', ')}.`,
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
                Recovery Policies
              </h1>
            </div>
          </div>

          {canEdit && !loading && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More policy actions"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground"
              >
                {syncing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MoreHorizontal size={16} />
                )}
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={syncing}
                  onClick={handleSyncDefaults}
                >
                  Sync default policies
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Control what Vidur can do automatically when a payment needs
          recovery. There is no fixed or provider-mandated value here — every
          limit below is yours to set, editable at any time.
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
        <div className="mt-8 flex flex-col gap-8">
          {groupedPolicies.map((group) => (
            <div key={group.id}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>

              <div className="mt-3 flex flex-col gap-3">
                {group.policies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    canEdit={canEdit}
                    onConfigure={() => handleConfigure(policy)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfigurePolicyDrawer
        key={configuringPolicy ? `${configuringPolicy.id}-${drawerSession}` : 'none'}
        policy={configuringPolicy}
        open={drawerOpen}
        canEdit={canEdit}
        saving={saving}
        error={saveError}
        onOpenChange={(nextOpen) => {
          setDrawerOpen(nextOpen)
          if (!nextOpen) setSaveError(null)
        }}
        onSave={handleSave}
      />
    </section>
  )
}
