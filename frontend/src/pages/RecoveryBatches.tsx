import { useEffect, useRef, useState } from 'react'
import { Layers, Loader2, Play, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getMerchants, type Merchant } from '../api/merchants'
import {
  detectBatch,
  getBatchStatus,
  runBatch,
  type RecoveryBatchStatus,
} from '../api/recoveryBatches'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { StatusBadge } from '../components/ui/status-badge'
import { batchStatusTone, formatAmount, formatLabel, caseStatusTone } from '../lib/status'

export function RecoveryBatches() {
  const navigate = useNavigate()

  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [selectedMerchantId, setSelectedMerchantId] = useState('')
  const [limitPerType, setLimitPerType] = useState(10)

  const [batch, setBatch] = useState<RecoveryBatchStatus | null>(null)

  const [loadingMerchants, setLoadingMerchants] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function loadMerchants() {
      try {
        const data = await getMerchants()
        setMerchants(data)
        if (data.length > 0) setSelectedMerchantId(data[0].id)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Unable to load merchants.',
        )
      } finally {
        setLoadingMerchants(false)
      }
    }

    loadMerchants()
  }, [])

  useEffect(() => {
    if (!batch || batch.status !== 'RUNNING' || batch.isComplete) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const updated = await getBatchStatus(batch.batchId)
        setBatch(updated)
      } catch {
        // transient poll failure — next tick retries
      }
    }, 3000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [batch])

  async function handleDetect() {
    if (!selectedMerchantId) return

    try {
      setError(null)
      setDetecting(true)
      const result = await detectBatch(selectedMerchantId, limitPerType)
      setBatch(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch detection failed.')
    } finally {
      setDetecting(false)
    }
  }

  async function handleRun() {
    if (!batch) return

    try {
      setError(null)
      setRunning(true)
      await runBatch(batch.batchId)
      const updated = await getBatchStatus(batch.batchId)
      setBatch(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch run failed.')
    } finally {
      setRunning(false)
    }
  }

  const statusEntries = batch ? Object.entries(batch.byStatus) : []

  return (
    <section className="pb-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Batch orchestration
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          Recovery Batches
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Detect a batch of revenue-at-risk cases for one merchant across
          failed payments, checkout abandonment and overdue receivables,
          then run the agent across all of them and watch measured recovery
          come in.
        </p>
      </div>

      <article className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="merchant">Merchant</Label>
            <select
              id="merchant"
              value={selectedMerchantId}
              onChange={(event) => setSelectedMerchantId(event.target.value)}
              disabled={loadingMerchants || merchants.length === 0}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-40 space-y-1.5">
            <Label htmlFor="limitPerType">Cases per scenario</Label>
            <Input
              id="limitPerType"
              type="number"
              min={1}
              max={50}
              value={limitPerType}
              onChange={(event) => setLimitPerType(Number(event.target.value))}
            />
          </div>

          <Button
            onClick={handleDetect}
            disabled={detecting || loadingMerchants || !selectedMerchantId}
          >
            {detecting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Detect Batch
          </Button>
        </div>
      </article>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {batch && (
        <>
          <article className="mt-5 rounded-xl border border-border bg-card p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Batch
                </p>
                <h2 className="mt-1 break-all font-mono text-sm text-foreground">
                  {batch.batchId}
                </h2>
              </div>

              <StatusBadge label={batch.status} tone={batchStatusTone(batch.status)} />
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <span className="block text-xs text-muted-foreground">Total cases</span>
                <strong className="mt-1.5 block text-lg font-semibold text-foreground">
                  {batch.totalCases}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <span className="block text-xs text-muted-foreground">Revenue at risk</span>
                <strong className="mt-1.5 block text-lg font-semibold text-foreground">
                  {formatAmount(batch.revenueAtRisk)}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <span className="block text-xs text-muted-foreground">Revenue recovered</span>
                <strong className="mt-1.5 block text-lg font-semibold text-foreground">
                  {formatAmount(batch.revenueRecovered)}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <span className="block text-xs text-muted-foreground">Recovery rate</span>
                <strong className="mt-1.5 block text-lg font-semibold text-foreground">
                  {Math.round(batch.recoveryRate * 100)}%
                </strong>
              </div>
            </div>

            {statusEntries.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {statusEntries.map(([status, count]) => (
                  <StatusBadge
                    key={status}
                    label={`${formatLabel(status)}: ${count}`}
                    tone={caseStatusTone(status)}
                  />
                ))}
              </div>
            )}

            <div className="mt-5">
              {batch.status === 'DETECTED' && (
                <Button onClick={handleRun} disabled={running || batch.totalCases === 0}>
                  {running ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  Run Batch
                </Button>
              )}

              {batch.status === 'RUNNING' && !batch.isComplete && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Agent is working through the batch — updating every few seconds...
                </div>
              )}

              {batch.isComplete && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-400">
                  <Layers size={20} className="mt-0.5 shrink-0" />
                  <div>
                    <strong className="block text-sm font-semibold">
                      Batch complete
                    </strong>
                    <span className="mt-1 block text-xs opacity-90">
                      {batch.recoveredCases} of {batch.totalCases} cases recovered —{' '}
                      {formatAmount(batch.revenueRecovered)} recovered of{' '}
                      {formatAmount(batch.revenueAtRisk)} at risk.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </article>

          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/recovery-cases')}
          >
            View recovery cases
          </Button>
        </>
      )}
    </section>
  )
}
