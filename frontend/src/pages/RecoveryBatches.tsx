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
import './RecoveryBatches.css'

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

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

        if (data.length > 0) {
          setSelectedMerchantId(data[0].id)
        }
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
      setError(
        err instanceof Error ? err.message : 'Batch detection failed.',
      )
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
    <section className="batches-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Batch orchestration</p>

          <h1>Recovery Batches</h1>

          <p className="page-description">
            Detect a batch of revenue-at-risk cases for one merchant across
            failed payments, checkout abandonment and overdue receivables,
            then run the agent across all of them and watch measured
            recovery come in.
          </p>
        </div>
      </div>

      <article className="batch-control-card">
        <div className="batch-control-row">
          <label className="batch-field">
            <span>Merchant</span>

            <select
              value={selectedMerchantId}
              onChange={(event) =>
                setSelectedMerchantId(event.target.value)
              }
              disabled={loadingMerchants || merchants.length === 0}
            >
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="batch-field batch-field-narrow">
            <span>Cases per scenario</span>

            <input
              type="number"
              min={1}
              max={50}
              value={limitPerType}
              onChange={(event) =>
                setLimitPerType(Number(event.target.value))
              }
            />
          </label>

          <button
            className="batch-primary-button"
            type="button"
            onClick={handleDetect}
            disabled={detecting || loadingMerchants || !selectedMerchantId}
          >
            {detecting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Search size={16} />
            )}
            Detect Batch
          </button>
        </div>
      </article>

      {error && <div className="batches-state error">{error}</div>}

      {batch && (
        <>
          <article className="batch-overview-card">
            <div className="batch-overview-heading">
              <div>
                <p className="section-eyebrow">Batch</p>
                <h2>{batch.batchId}</h2>
              </div>

              <span
                className={`status-pill batch-status-${batch.status.toLowerCase()}`}
              >
                {formatLabel(batch.status)}
              </span>
            </div>

            <div className="batch-metrics-grid">
              <div className="batch-metric">
                <span>Total cases</span>
                <strong>{batch.totalCases}</strong>
              </div>

              <div className="batch-metric">
                <span>Revenue at risk</span>
                <strong>{formatAmount(batch.revenueAtRisk)}</strong>
              </div>

              <div className="batch-metric">
                <span>Revenue recovered</span>
                <strong>{formatAmount(batch.revenueRecovered)}</strong>
              </div>

              <div className="batch-metric">
                <span>Recovery rate</span>
                <strong>
                  {Math.round(batch.recoveryRate * 100)}%
                </strong>
              </div>
            </div>

            {statusEntries.length > 0 && (
              <div className="batch-status-breakdown">
                {statusEntries.map(([status, count]) => (
                  <span
                    key={status}
                    className={`status-pill status-${status.toLowerCase()}`}
                  >
                    {formatLabel(status)}: {count}
                  </span>
                ))}
              </div>
            )}

            {batch.status === 'DETECTED' && (
              <button
                className="batch-primary-button"
                type="button"
                onClick={handleRun}
                disabled={running || batch.totalCases === 0}
              >
                {running ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Play size={16} />
                )}
                Run Batch
              </button>
            )}

            {batch.status === 'RUNNING' && !batch.isComplete && (
              <div className="batch-running-indicator">
                <Loader2 size={16} className="spin" />
                <span>
                  Agent is working through the batch — updating every few
                  seconds...
                </span>
              </div>
            )}

            {batch.isComplete && (
              <div className="batch-complete-banner">
                <Layers size={20} />

                <div>
                  <strong>Batch complete</strong>

                  <span>
                    {batch.recoveredCases} of {batch.totalCases} cases
                    recovered — {formatAmount(batch.revenueRecovered)}{' '}
                    recovered of {formatAmount(batch.revenueAtRisk)} at
                    risk.
                  </span>
                </div>
              </div>
            )}
          </article>

          <button
            className="batch-secondary-button"
            type="button"
            onClick={() => navigate('/recovery-cases')}
          >
            View recovery cases
          </button>
        </>
      )}
    </section>
  )
}
