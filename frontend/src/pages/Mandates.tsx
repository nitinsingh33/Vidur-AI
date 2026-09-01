import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  createMandate,
  deleteMandate,
  getMandates,
  runMandateRetrySequencer,
  type Mandate,
} from '../api/mandates'
import {
  createCustomer,
  getCustomers,
  type Customer,
} from '../api/customers'
import { getPolicies, type Policy } from '../api/policies'
import { useAuth } from '../context/AuthContext'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { StatusBadge } from '../components/ui/status-badge'
import { DeleteButton } from '../components/ui/delete-button'
import {
  actionStatusTone,
  caseStatusTone,
  formatAmount,
  formatLabel,
  mandateStatusTone,
} from '../lib/status'
import { loadRazorpayCheckoutScript } from '../lib/razorpayCheckout'

const LIVE_STATUSES = new Set(['CREATED', 'CONFIRMED'])

export function Mandates() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [mandates, setMandates] = useState<Mandate[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [method, setMethod] = useState<'upi' | 'emandate'>('upi')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [sequencing, setSequencing] = useState(false)
  const [sequencerMessage, setSequencerMessage] = useState<string | null>(
    null,
  )
  const [retryPolicy, setRetryPolicy] = useState<Policy | null>(null)
  // Snapshot of "now" taken once per load — used only for the display
  // estimate below, not a live countdown. Computed in an effect (not during
  // render) since Date.now() is an impure call.
  const [nowMs, setNowMs] = useState<number>(0)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [mandateData, customerData, policies] = await Promise.all([
          getMandates(token as string),
          getCustomers(token as string),
          getPolicies(token as string),
        ])
        setMandates(mandateData)
        setCustomers(customerData)
        setRetryPolicy(
          policies.find((p) => p.actionType === 'RETRY_PAYMENT') ?? null,
        )
        setNowMs(Date.now())
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load mandates.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  /**
   * A client-side estimate for display only — PolicyService on the backend
   * is the actual authority on eligibility. Mirrors the same configured
   * policy (max retries + retry interval) the sequencer and manual retries
   * both go through.
   */
  function describeRetryEligibility(mandate: Mandate, nowMs: number): string {
    if (mandate.status !== 'CONFIRMED') {
      return `Not retriable — mandate is ${formatLabel(mandate.status).toLowerCase()}.`
    }

    if (!retryPolicy || !retryPolicy.enabled) {
      return 'No retry policy configured — retries are blocked until one is enabled.'
    }

    if (
      retryPolicy.maxRetries !== null &&
      mandate.failedDebitCount > retryPolicy.maxRetries
    ) {
      return `Retry limit reached (${mandate.failedDebitCount}/${retryPolicy.maxRetries} configured).`
    }

    if (retryPolicy.retryIntervalMinutes !== null && mandate.lastAttemptAt) {
      const elapsedMs = nowMs - new Date(mandate.lastAttemptAt).getTime()
      const remainingMinutes = Math.ceil(
        retryPolicy.retryIntervalMinutes - elapsedMs / 60_000,
      )

      if (remainingMinutes > 0) {
        return `Next retry eligible in ~${remainingMinutes} min (configured policy).`
      }
    }

    if (retryPolicy.decision === 'REQUIRE_APPROVAL') {
      return 'Eligible now — requires merchant approval before it runs.'
    }

    if (retryPolicy.decision === 'BLOCK') {
      return 'Policy currently set to block this action.'
    }

    return 'Eligible for the next scheduled retry.'
  }

  async function refreshMandates() {
    if (!token) return
    const data = await getMandates(token)
    setMandates(data)
    setNowMs(Date.now())
  }

  async function handleDeleteMandate(mandateId: string) {
    if (!token) return

    await deleteMandate(token, mandateId)

    setMandates((current) => current.filter((item) => item.id !== mandateId))
  }

  async function handleCreateMandate(event: FormEvent) {
    event.preventDefault()
    if (!token) return

    try {
      setFormError(null)
      setCreating(true)

      let resolvedCustomerId = customerId
      let prefillName = ''
      let prefillEmail = ''
      let prefillPhone = ''

      if (showNewCustomer) {
        if (!newCustomerName.trim()) {
          throw new Error('Customer name is required.')
        }
        const customer = await createCustomer(token, {
          name: newCustomerName.trim(),
          email: newCustomerEmail.trim() || undefined,
          phone: newCustomerPhone.trim() || undefined,
        })
        resolvedCustomerId = customer.id
        prefillName = customer.name
        prefillEmail = customer.email ?? ''
        prefillPhone = customer.phone ?? ''
        setCustomers((current) => [customer, ...current])
      } else {
        const existing = customers.find((c) => c.id === customerId)
        prefillName = existing?.name ?? ''
        prefillEmail = existing?.email ?? ''
        prefillPhone = existing?.phone ?? ''
      }

      if (!resolvedCustomerId) {
        throw new Error('Select or create a customer.')
      }

      if (!maxAmount || Number(maxAmount) <= 0) {
        throw new Error('Enter a positive maximum amount.')
      }

      const registration = await createMandate(token, {
        customerId: resolvedCustomerId,
        maxAmount: Number(maxAmount),
        method,
      })

      await loadRazorpayCheckoutScript()

      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout script did not load.')
      }

      const rzp = new window.Razorpay({
        key: registration.keyId,
        amount: Math.round(registration.amount * 100),
        currency: registration.currency,
        order_id: registration.registrationOrderId,
        name: 'Vidur AI',
        description: 'Mandate authorization — Vidur AI',
        recurring: true,
        prefill: {
          name: prefillName || undefined,
          email: prefillEmail || undefined,
          contact: prefillPhone || undefined,
        },
        theme: { color: '#2563eb' },
        handler: () => {
          void refreshMandates()
        },
      })

      rzp.open()

      setMaxAmount('')
      setCustomerId('')
      setNewCustomerName('')
      setNewCustomerEmail('')
      setNewCustomerPhone('')
      setShowNewCustomer(false)
      setShowForm(false)
      await refreshMandates()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to register the mandate.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleRunSequencer() {
    if (!token) return

    try {
      setSequencing(true)
      setSequencerMessage(null)
      const result = await runMandateRetrySequencer(token)
      setSequencerMessage(
        result.attempted > 0
          ? `Scanned ${result.scanned} eligible case${result.scanned === 1 ? '' : 's'}, retried ${result.attempted}, skipped ${result.skipped}.`
          : `Scanned ${result.scanned} eligible case${result.scanned === 1 ? '' : 's'} — none due for a retry yet.`,
      )
      await refreshMandates()
    } catch (err) {
      setSequencerMessage(
        err instanceof Error ? err.message : 'Unable to run the sequencer.',
      )
    } finally {
      setSequencing(false)
    }
  }

  const liveMandates = mandates.filter((m) => LIVE_STATUSES.has(m.status))
  const confirmedMandates = mandates.filter((m) => m.status === 'CONFIRMED')
  const needsAttention = mandates.filter((m) =>
    ['REJECTED', 'PAUSED', 'CANCELLED'].includes(m.status),
  )

  const recurringCeiling = liveMandates.reduce(
    (total, m) => total + Number(m.maxAmount),
    0,
  )

  return (
    <section className="pb-12">
      <header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Mandates
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRunSequencer}
            disabled={sequencing}
            variant="outline"
          >
            {sequencing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Run retry sequencer now
          </Button>
          <Button onClick={() => setShowForm((current) => !current)}>
            <Plus size={15} />
            New mandate
          </Button>
        </div>
      </header>

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Each mandate is a real Razorpay UPI Autopay/eNACH recurring
        authorization. Unlike Subscriptions, Razorpay doesn't auto-retry a
        failed mandate debit — the retry sequencer re-presents it directly
        against the confirmed mandate according to your configured retry
        policy.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-4 py-2.5 text-sm text-muted-foreground">
        <ShieldCheck size={14} className="shrink-0 text-primary" />
        {retryPolicy ? (
          <span>
            Configured retry policy for failed debits:{' '}
            <span className="font-medium text-foreground">
              {formatLabel(retryPolicy.decision)}
            </span>
            {retryPolicy.maxRetries !== null &&
              `, up to ${retryPolicy.maxRetries} retries`}
            {retryPolicy.retryIntervalMinutes !== null &&
              `, at least ${retryPolicy.retryIntervalMinutes} min apart`}
            . Editable on the{' '}
            <a href="/policies" className="text-primary hover:underline">
              Policies
            </a>{' '}
            page.
          </span>
        ) : (
          <span>
            No merchant policy configured for retries yet — configure one on
            the{' '}
            <a href="/policies" className="text-primary hover:underline">
              Policies
            </a>{' '}
            page.
          </span>
        )}
      </div>

      {sequencerMessage && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 px-4 py-2.5 text-sm text-muted-foreground">
          {sequencerMessage}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreateMandate}
          className="mt-5 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold text-foreground">
            New mandate
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Opens Razorpay Checkout to complete the one-time authorization —
            this mandate can't be charged until that's done.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mandate-customer">Customer</Label>
              {!showNewCustomer ? (
                <div className="mt-1.5 space-y-2">
                  <select
                    id="mandate-customer"
                    className="h-8 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                  >
                    <option value="">Select a customer…</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.email ? ` (${customer.email})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    + Add a new customer
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 space-y-2">
                  <Input
                    placeholder="Customer name"
                    value={newCustomerName}
                    onChange={(event) =>
                      setNewCustomerName(event.target.value)
                    }
                  />
                  <Input
                    placeholder="Email (optional)"
                    type="email"
                    value={newCustomerEmail}
                    onChange={(event) =>
                      setNewCustomerEmail(event.target.value)
                    }
                  />
                  <Input
                    placeholder="Phone (optional)"
                    value={newCustomerPhone}
                    onChange={(event) =>
                      setNewCustomerPhone(event.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className="text-xs font-medium text-muted-foreground hover:underline"
                  >
                    Choose an existing customer instead
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="max-amount">Maximum amount per debit (₹)</Label>
                <Input
                  id="max-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  className="mt-1.5"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="method">Authorization method</Label>
                <select
                  id="method"
                  className="mt-1.5 h-8 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as 'upi' | 'emandate')
                  }
                >
                  <option value="upi">UPI Autopay</option>
                  <option value="emandate">eNACH (net banking)</option>
                </select>
              </div>
            </div>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-destructive">{formError}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 size={15} className="animate-spin" />}
              Register mandate
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <MetricCard
              label="Recurring ceiling"
              value={formatAmount(recurringCeiling)}
              description={`${liveMandates.length} live mandate${liveMandates.length === 1 ? '' : 's'}`}
              icon={Landmark}
              tone="primary"
            />

            <MetricCard
              label="Confirmed"
              value={String(confirmedMandates.length)}
              description="mandates actively chargeable"
              icon={ShieldCheck}
              tone="emerald"
            />

            <MetricCard
              label="Needs attention"
              value={String(needsAttention.length)}
              description="rejected, paused, or cancelled"
              icon={AlertTriangle}
              tone="amber"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                UPI Autopay / eNACH
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                All mandates
              </h2>
            </div>

            {mandates.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No mandates yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Register one to start tracking recurring authorizations.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Max amount</th>
                      <th className="px-3 py-3 font-medium">Method</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Failed debits</th>
                      <th className="px-3 py-3 font-medium">Retry eligibility</th>
                      <th className="px-3 py-3 font-medium">Latest action</th>
                      <th className="px-3 py-3 font-medium">Case</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {mandates.map((mandate) => {
                      const latestCase = mandate.recoveryCases[0] ?? null
                      const latestAction = latestCase?.actions[0] ?? null

                      return (
                        <tr
                          key={mandate.id}
                          className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                          onClick={() =>
                            latestCase &&
                            navigate(`/recovery-cases/${latestCase.id}`)
                          }
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {mandate.customer.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {mandate.customer.email ?? 'No email'}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3.5 font-medium text-foreground">
                            {formatAmount(mandate.maxAmount, mandate.currency)}
                          </td>

                          <td className="px-3 py-3.5 text-muted-foreground">
                            {mandate.method === 'upi' ? 'UPI Autopay' : 'eNACH'}
                          </td>

                          <td className="px-3 py-3.5">
                            <StatusBadge
                              label={mandate.status}
                              tone={mandateStatusTone(mandate.status)}
                            />
                          </td>

                          <td className="px-3 py-3.5 font-mono text-xs text-muted-foreground">
                            {mandate.failedDebitCount}
                            {retryPolicy?.maxRetries !== null &&
                              retryPolicy?.maxRetries !== undefined &&
                              ` / ${retryPolicy.maxRetries}`}
                          </td>

                          <td className="px-3 py-3.5 max-w-[220px] text-xs text-muted-foreground">
                            {describeRetryEligibility(mandate, nowMs)}
                          </td>

                          <td
                            className="max-w-[240px] px-3 py-3.5"
                            title={latestAction?.reason ?? undefined}
                          >
                            {latestAction ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {formatLabel(latestAction.type)}
                                </span>
                                <StatusBadge
                                  className="mt-1 w-fit"
                                  label={latestAction.status}
                                  tone={actionStatusTone(latestAction.status)}
                                />
                                {latestAction.status === 'FAILED' &&
                                  latestAction.result?.message && (
                                    <span className="mt-1 truncate text-[11px] text-destructive">
                                      {latestAction.result.message}
                                    </span>
                                  )}
                                {latestAction.policyDecision ===
                                  'REQUIRE_APPROVAL' && (
                                  <span className="mt-1 text-[11px] text-amber-500">
                                    Awaiting your approval
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                No action yet
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3.5">
                            {latestCase ? (
                              <div className="flex flex-col">
                                <StatusBadge
                                  className="w-fit"
                                  label={latestCase.status}
                                  tone={caseStatusTone(latestCase.status)}
                                />
                                {latestCase.outcome && (
                                  <span className="mt-1 text-[11px] text-emerald-500">
                                    Recovered {formatAmount(latestCase.outcome.recoveredAmount)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>

                          <td className="px-3 py-3.5">
                            <DeleteButton
                              size="sm"
                              stopPropagation
                              onConfirm={() => handleDeleteMandate(mandate.id)}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
