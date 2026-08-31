import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CircleDollarSign,
  Loader2,
  Plus,
  Repeat,
} from 'lucide-react'
import {
  createSubscription,
  getSubscriptions,
  type CreateSubscriptionResult,
  type Subscription,
} from '../api/subscriptions'
import {
  createCustomer,
  getCustomers,
  type Customer,
} from '../api/customers'
import { useAuth } from '../context/AuthContext'
import { MetricCard } from '../components/dashboard/MetricCard'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import { StatusBadge } from '../components/ui/status-badge'
import {
  actionStatusTone,
  caseStatusTone,
  formatAmount,
  formatLabel,
  subscriptionStatusTone,
} from '../lib/status'

const LIVE_STATUSES = new Set(['ACTIVE', 'PAYMENT_FAILED'])

export function Subscriptions() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(
    'monthly',
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] =
    useState<CreateSubscriptionResult | null>(null)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [subscriptionData, customerData] = await Promise.all([
          getSubscriptions(token as string),
          getCustomers(token as string),
        ])
        setSubscriptions(subscriptionData)
        setCustomers(customerData)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load subscriptions.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  async function refreshSubscriptions() {
    if (!token) return
    const data = await getSubscriptions(token)
    setSubscriptions(data)
  }

  async function handleCreateSubscription(event: FormEvent) {
    event.preventDefault()
    if (!token) return

    try {
      setFormError(null)
      setCreating(true)
      setJustCreated(null)

      let resolvedCustomerId = customerId

      if (showNewCustomer) {
        if (!newCustomerName.trim()) {
          throw new Error('Customer name is required.')
        }
        const customer = await createCustomer(token, {
          name: newCustomerName.trim(),
          email: newCustomerEmail.trim() || undefined,
        })
        resolvedCustomerId = customer.id
        setCustomers((current) => [customer, ...current])
      }

      if (!resolvedCustomerId) {
        throw new Error('Select or create a customer.')
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error('Enter a positive amount.')
      }

      const result = await createSubscription(token, {
        customerId: resolvedCustomerId,
        amount: Number(amount),
        period,
      })

      setJustCreated(result)
      setAmount('')
      setCustomerId('')
      setNewCustomerName('')
      setNewCustomerEmail('')
      setShowNewCustomer(false)
      setShowForm(false)
      await refreshSubscriptions()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to create the subscription.',
      )
    } finally {
      setCreating(false)
    }
  }

  const liveSubscriptions = subscriptions.filter((subscription) =>
    LIVE_STATUSES.has(subscription.status),
  )
  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === 'ACTIVE',
  )
  const failingSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === 'PAYMENT_FAILED',
  )

  const monthlyRecurringRevenue = liveSubscriptions.reduce(
    (total, subscription) => total + Number(subscription.amount),
    0,
  )
  const revenueAtRisk = failingSubscriptions.reduce(
    (total, subscription) => total + Number(subscription.amount),
    0,
  )

  return (
    <section className="pb-12">
      <header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Repeat size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Subscriptions
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowForm((current) => !current)}>
            <Plus size={15} />
            New subscription
          </Button>
        </div>
      </header>

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Each subscription is a real Razorpay recurring mandate. Failed renewal
        charges (subscription.pending) and exhausted retries
        (subscription.halted) are real Razorpay webhooks — the same
        follow-up/policy/escalation loop as every other scenario picks them up
        automatically.
      </p>

      {justCreated && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Subscription created.</p>
          <p className="mt-1 text-muted-foreground">
            The customer must complete a one-time mandate authorization before
            Razorpay begins auto-charging — until then, no renewal can succeed
            or fail.
          </p>
          <a
            href={justCreated.shortUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            Open authorization link →
          </a>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreateSubscription}
          className="mt-5 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold text-foreground">
            New subscription
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customer">Customer</Label>
              {!showNewCustomer ? (
                <div className="mt-1.5 space-y-2">
                  <select
                    id="customer"
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
                <Label htmlFor="amount">Amount per cycle (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  className="mt-1.5"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="period">Billing interval</Label>
                <select
                  id="period"
                  className="mt-1.5 h-8 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                  value={period}
                  onChange={(event) =>
                    setPeriod(
                      event.target.value as
                        | 'daily'
                        | 'weekly'
                        | 'monthly'
                        | 'yearly',
                    )
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
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
              Create subscription
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
              label="Recurring revenue"
              value={formatAmount(monthlyRecurringRevenue)}
              description={`${liveSubscriptions.length} live subscription${liveSubscriptions.length === 1 ? '' : 's'}`}
              icon={Repeat}
              tone="primary"
            />

            <MetricCard
              label="At risk"
              value={formatAmount(revenueAtRisk)}
              description={`${failingSubscriptions.length} failing charge${failingSubscriptions.length === 1 ? '' : 's'}`}
              icon={AlertTriangle}
              tone="amber"
            />

            <MetricCard
              label="Active"
              value={String(activeSubscriptions.length)}
              description="subscriptions charging normally"
              icon={CircleDollarSign}
              tone="emerald"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recurring billing
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                All subscriptions
              </h2>
            </div>

            {subscriptions.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No subscriptions yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one to start tracking recurring billing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Amount</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Failed charges</th>
                      <th className="px-3 py-3 font-medium">Latest action</th>
                      <th className="px-3 py-3 font-medium">Case</th>
                    </tr>
                  </thead>

                  <tbody>
                    {subscriptions.map((subscription) => {
                      const latestCase =
                        subscription.recoveryCases[0] ?? null
                      const latestAction = latestCase?.actions[0] ?? null

                      return (
                        <tr
                          key={subscription.id}
                          className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                          onClick={() =>
                            latestCase &&
                            navigate(`/recovery-cases/${latestCase.id}`)
                          }
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {subscription.customer.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {subscription.customer.email ?? 'No email'}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3.5 font-medium text-foreground">
                            {formatAmount(
                              subscription.amount,
                              subscription.currency,
                            )}
                          </td>

                          <td className="px-3 py-3.5">
                            <StatusBadge
                              label={subscription.status}
                              tone={subscriptionStatusTone(
                                subscription.status,
                              )}
                            />
                          </td>

                          <td className="px-3 py-3.5 font-mono text-xs text-muted-foreground">
                            {subscription.failedPaymentCount}
                          </td>

                          <td className="px-3 py-3.5">
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
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                No action yet
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3.5">
                            {latestCase ? (
                              <StatusBadge
                                label={latestCase.status}
                                tone={caseStatusTone(latestCase.status)}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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
