const API_BASE_URL = 'http://localhost:3000'

export interface RecoveryBatchStatus {
  batchId: string
  merchantId: string
  status: 'DETECTED' | 'RUNNING' | 'COMPLETED'
  totalCases: number
  byStatus: Record<string, number>
  isComplete: boolean
  recoveredCases: number
  revenueAtRisk: number
  revenueRecovered: number
  recoveryRate: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface RunBatchResult {
  batchId: string
  enqueuedCount: number
}

export async function detectBatch(
  merchantId: string,
  limitPerType: number,
): Promise<RecoveryBatchStatus> {
  const response = await fetch(`${API_BASE_URL}/recovery-batches/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId, limitPerType }),
  })

  if (!response.ok) {
    throw new Error(`Batch detection failed: ${response.status}`)
  }

  return response.json()
}

export async function runBatch(
  batchId: string,
): Promise<RunBatchResult> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-batches/${batchId}/run`,
    { method: 'POST' },
  )

  if (!response.ok) {
    throw new Error(`Batch run failed: ${response.status}`)
  }

  return response.json()
}

export async function getBatchStatus(
  batchId: string,
): Promise<RecoveryBatchStatus> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-batches/${batchId}`,
  )

  if (!response.ok) {
    throw new Error(`Batch status request failed: ${response.status}`)
  }

  return response.json()
}
