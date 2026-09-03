import { useState, type ReactNode } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Loader2, X } from 'lucide-react'
import type { Policy, UpdatePolicyPayload } from '../../api/policies'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { formatAmount } from '../../lib/status'
import {
  POLICY_DECISIONS,
  POLICY_DECISION_HELP,
  POLICY_DECISION_LABEL,
  getEffectiveDecision,
  getPolicyActionMeta,
  getPolicySubtitle,
  getPolicyTitle,
  summarizePolicyLimits,
  type PolicyDecision,
} from '../../lib/policyLabels'
import { cn } from '../../lib/utils'

interface ConfigurePolicyDrawerProps {
  policy: Policy | null
  open: boolean
  canEdit: boolean
  saving: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSave: (policyId: string, updates: UpdatePolicyPayload) => Promise<void>
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function numberFieldValue(value: number | string | null): string {
  return value === null || value === undefined ? '' : String(value)
}

export function ConfigurePolicyDrawer({
  policy,
  open,
  canEdit,
  saving,
  error,
  onOpenChange,
  onSave,
}: ConfigurePolicyDrawerProps) {
  // Lazy initializers only run once, on mount — the caller is responsible
  // for remounting this component (via a `key` that changes on every
  // "Configure" click, see Policies.tsx) whenever it should show a fresh
  // copy of a policy. That guarantees cancelling an edit and reopening the
  // same policy never shows stale, discarded input, without needing an
  // effect to re-sync state from a prop.
  const [decision, setDecision] = useState<PolicyDecision>(
    () => (policy?.decision as PolicyDecision | undefined) ?? 'ALLOW',
  )
  const [enabled, setEnabled] = useState(() => policy?.enabled ?? true)
  const [maxRetries, setMaxRetries] = useState(() =>
    numberFieldValue(policy?.maxRetries ?? null),
  )
  const [retryIntervalMinutes, setRetryIntervalMinutes] = useState(() =>
    numberFieldValue(policy?.retryIntervalMinutes ?? null),
  )
  const [maxContacts, setMaxContacts] = useState(() =>
    numberFieldValue(policy?.maxContacts ?? null),
  )
  const [maxAmount, setMaxAmount] = useState(() =>
    numberFieldValue(policy?.maxAmount ?? null),
  )

  if (!policy) return null

  const meta = getPolicyActionMeta(policy.actionType)
  const primaryIsRetries = meta.countField === 'maxRetries'
  const primaryIsContacts = meta.countField === 'maxContacts'
  const countLabel = `Maximum ${meta.countNoun}`

  async function handleSave() {
    if (!policy) return

    await onSave(policy.id, {
      decision,
      enabled,
      maxRetries: toNullableNumber(maxRetries),
      retryIntervalMinutes: toNullableNumber(retryIntervalMinutes),
      maxContacts: toNullableNumber(maxContacts),
      maxAmount: toNullableNumber(maxAmount),
    })
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200',
            'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
          )}
        />

        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-xl outline-none sm:max-w-md',
            'transition-transform duration-200 ease-out',
            'data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                {getPolicyTitle(policy)}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {canEdit
                  ? `Configure when Vidur can ${meta.title.charAt(0).toLowerCase()}${meta.title.slice(1)}.`
                  : getPolicySubtitle(policy)}
              </DialogPrimitive.Description>
            </div>

            <DialogPrimitive.Close
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {!canEdit ? (
              <ReadOnlyPolicyDetails policy={policy} />
            ) : (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Execution
                  </p>

                  <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                    {POLICY_DECISIONS.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={decision === option ? 'default' : 'outline'}
                        onClick={() => setDecision(option)}
                        className="justify-center"
                      >
                        {POLICY_DECISION_LABEL[option]}
                      </Button>
                    ))}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {POLICY_DECISION_HELP[decision]}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Policy active
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {enabled
                        ? 'This policy is in effect.'
                        : 'Turned off — Vidur will block this action until it’s turned back on, regardless of the execution mode above.'}
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div
                  className={cn(
                    'flex flex-col gap-4',
                    !enabled && 'opacity-50',
                  )}
                >
                  {(primaryIsRetries || primaryIsContacts) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {primaryIsRetries && (
                        <Field label="Maximum attempts">
                          <Input
                            type="number"
                            min="0"
                            placeholder="No limit"
                            disabled={!enabled || saving}
                            value={maxRetries}
                            onChange={(event) =>
                              setMaxRetries(event.target.value)
                            }
                          />
                        </Field>
                      )}

                      {primaryIsRetries && (
                        <Field label="Minutes between attempts">
                          <Input
                            type="number"
                            min="0"
                            placeholder="No minimum"
                            disabled={!enabled || saving}
                            value={retryIntervalMinutes}
                            onChange={(event) =>
                              setRetryIntervalMinutes(event.target.value)
                            }
                          />
                        </Field>
                      )}

                      {primaryIsContacts && (
                        <Field label={countLabel} className="col-span-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="No limit"
                            disabled={!enabled || saving}
                            value={maxContacts}
                            onChange={(event) =>
                              setMaxContacts(event.target.value)
                            }
                          />
                        </Field>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Advanced / safety limits
                    </p>

                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Maximum payment amount (₹)">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="No limit"
                          disabled={!enabled || saving}
                          value={maxAmount}
                          onChange={(event) => setMaxAmount(event.target.value)}
                        />
                      </Field>

                      {!primaryIsContacts && (
                        <Field label="Maximum customer contacts">
                          <Input
                            type="number"
                            min="0"
                            placeholder="No limit"
                            disabled={!enabled || saving}
                            value={maxContacts}
                            onChange={(event) =>
                              setMaxContacts(event.target.value)
                            }
                          />
                        </Field>
                      )}

                      {!primaryIsRetries && (
                        <Field label="Maximum attempts">
                          <Input
                            type="number"
                            min="0"
                            placeholder="No limit"
                            disabled={!enabled || saving}
                            value={maxRetries}
                            onChange={(event) =>
                              setMaxRetries(event.target.value)
                            }
                          />
                        </Field>
                      )}

                      {!primaryIsRetries && (
                        <Field label="Minutes between attempts">
                          <Input
                            type="number"
                            min="0"
                            placeholder="No minimum"
                            disabled={!enabled || saving}
                            value={retryIntervalMinutes}
                            onChange={(event) =>
                              setRetryIntervalMinutes(event.target.value)
                            }
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            {canEdit ? (
              <>
                <DialogPrimitive.Close
                  render={
                    <Button type="button" variant="outline" disabled={saving}>
                      Cancel
                    </Button>
                  }
                />
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save changes
                </Button>
              </>
            ) : (
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline">
                    Close
                  </Button>
                }
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ReadOnlyPolicyDetails({ policy }: { policy: Policy }) {
  const effective = getEffectiveDecision(policy)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Execution
        </p>
        <p className="mt-1.5 text-sm font-medium text-foreground">
          {POLICY_DECISION_LABEL[effective]}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {POLICY_DECISION_HELP[effective]}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Limits
        </p>
        <p className="mt-1.5 text-sm text-foreground">
          {summarizePolicyLimits(policy)}
        </p>
        {policy.maxAmount && (
          <p className="mt-1 text-xs text-muted-foreground">
            Capped at {formatAmount(policy.maxAmount)} per action.
          </p>
        )}
      </div>
    </div>
  )
}
