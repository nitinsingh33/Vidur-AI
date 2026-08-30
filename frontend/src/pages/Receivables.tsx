import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CircleDollarSign,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Timer,
} from 'lucide-react'
import {
  createInvoice,
  getInvoices,
  markInvoicePaid,
  runInvoiceSweep,
  type Invoice,
} from '../api/invoices'
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
  invoiceStatusTone,
} from '../lib/status'

const OUTSTANDING_STATUSES = new Set(['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'])

export function Receivables() {
  const navigate = useNavigate()
  const { token } = useAuth()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [sweeping, setSweeping] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [invoiceData, customerData] = await Promise.all([
          getInvoices(token as string),
          getCustomers(token as string),
        ])
        setInvoices(invoiceData)
        setCustomers(customerData)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load receivables.',
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  async function refreshInvoices() {
    if (!token) return
    const data = await getInvoices(token)
    setInvoices(data)
  }

  async function handleCreateInvoice(event: FormEvent) {
    event.preventDefault()
    if (!token) return

    try {
      setFormError(null)
      setCreating(true)

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

      if (!dueDate) {
        throw new Error('Enter a due date.')
      }

      await createInvoice(token, {
        customerId: resolvedCustomerId,
        amount: Number(amount),
        dueDate: new Date(dueDate).toISOString(),
      })

      setAmount('')
      setDueDate('')
      setCustomerId('')
      setNewCustomerName('')
      setNewCustomerEmail('')
      setShowNewCustomer(false)
      setShowForm(false)
      await refreshInvoices()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to create the invoice.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    if (!token) return

    try {
      setMarkingPaidId(invoiceId)
      await markInvoicePaid(token, invoiceId)
      await refreshInvoices()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to mark invoice paid.',
      )
    } finally {
      setMarkingPaidId(null)
    }
  }

  async function handleRunSweep() {
    if (!token) return

    try {
      setSweeping(true)
      setSweepMessage(null)
      const result = await runInvoiceSweep(token)
      setSweepMessage(
        result.opened > 0
          ? `${result.scanned} invoice${result.scanned === 1 ? '' : 's'} turned overdue, opened ${result.opened} new case${result.opened === 1 ? '' : 's'}.`
          : `Scanned ${result.scanned} invoice${result.scanned === 1 ? '' : 's'} — none newly overdue.`,
      )
      await refreshInvoices()
    } catch (err) {
      setSweepMessage(
        err instanceof Error ? err.message : 'Unable to run the sweep.',
      )
    } finally {
      setSweeping(false)
    }
  }

  const outstandingInvoices = invoices.filter((invoice) =>
    OUTSTANDING_STATUSES.has(invoice.status),
  )
  const overdueInvoices = invoices.filter(
    (invoice) => invoice.status === 'OVERDUE',
  )
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'PAID')

  const outstandingAmount = outstandingInvoices.reduce(
    (total, invoice) => total + Number(invoice.amount),
    0,
  )
  const overdueAmount = overdueInvoices.reduce(
    (total, invoice) => total + Number(invoice.amount),
    0,
  )
  const recoveredAmount = paidInvoices.reduce(
    (total, invoice) => total + Number(invoice.amount),
    0,
  )

  return (
    <section className="pb-12">
      <header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Recovery intelligence
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              B2B Receivables
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleRunSweep} disabled={sweeping} variant="outline">
            {sweeping ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            Run sweep now
          </Button>
          <Button onClick={() => setShowForm((current) => !current)}>
            <Plus size={15} />
            New invoice
          </Button>
        </div>
      </header>

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Invoices are entered here manually. A scheduled sweep flips any
        invoice past its due date to overdue and opens a real recovery case —
        the same follow-up/policy/escalation loop as every other scenario.
      </p>

      {sweepMessage && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 px-4 py-2.5 text-sm text-muted-foreground">
          {sweepMessage}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreateInvoice}
          className="mt-5 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold text-foreground">
            New invoice
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
                <Label htmlFor="amount">Amount (₹)</Label>
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
                <Label htmlFor="dueDate">Due date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  className="mt-1.5"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-destructive">{formError}</p>
          )}

          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 size={15} className="animate-spin" />}
              Create invoice
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
              label="Outstanding"
              value={formatAmount(outstandingAmount)}
              description={`${outstandingInvoices.length} unpaid invoice${outstandingInvoices.length === 1 ? '' : 's'}`}
              icon={Timer}
              tone="primary"
            />

            <MetricCard
              label="Overdue"
              value={formatAmount(overdueAmount)}
              description={`${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} past due`}
              icon={Timer}
              tone="amber"
            />

            <MetricCard
              label="Recovered"
              value={formatAmount(recoveredAmount)}
              description={`${paidInvoices.length} invoice${paidInvoices.length === 1 ? '' : 's'} paid`}
              icon={CircleDollarSign}
              tone="emerald"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Receivables
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                All invoices
              </h2>
            </div>

            {invoices.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No invoices yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one to start tracking a receivable.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-3 py-3 font-medium">Amount</th>
                      <th className="px-3 py-3 font-medium">Due date</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Latest action</th>
                      <th className="px-3 py-3 font-medium">Outcome</th>
                      <th className="px-3 py-3 font-medium" />
                    </tr>
                  </thead>

                  <tbody>
                    {invoices.map((invoice) => {
                      const latestCase = invoice.recoveryCases[0] ?? null
                      const latestAction = latestCase?.actions[0] ?? null

                      return (
                        <tr
                          key={invoice.id}
                          className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/40"
                        >
                          <td
                            className="cursor-pointer px-5 py-3.5"
                            onClick={() =>
                              latestCase &&
                              navigate(`/recovery-cases/${latestCase.id}`)
                            }
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {invoice.customer.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {invoice.customer.email ?? 'No email'}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3.5 font-medium text-foreground">
                            {formatAmount(invoice.amount, invoice.currency)}
                          </td>

                          <td className="px-3 py-3.5 text-muted-foreground">
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>

                          <td className="px-3 py-3.5">
                            <StatusBadge
                              label={invoice.status}
                              tone={invoiceStatusTone(invoice.status)}
                            />
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

                          <td className="px-3 py-3.5 text-right">
                            {invoice.status !== 'PAID' && (
                              <Button
                                variant="outline"
                                className="h-7 px-2.5 text-xs"
                                disabled={markingPaidId === invoice.id}
                                onClick={() => handleMarkPaid(invoice.id)}
                              >
                                {markingPaidId === invoice.id ? (
                                  <Loader2
                                    size={13}
                                    className="animate-spin"
                                  />
                                ) : (
                                  'Mark paid'
                                )}
                              </Button>
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
