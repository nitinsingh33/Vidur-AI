const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

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
  token: string,
  merchantId: string,
  limitPerType: number,
): Promise<RecoveryBatchStatus> {
  const response = await fetch(`${API_BASE_URL}/recovery-batches/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ merchantId, limitPerType }),
  })

  if (!response.ok) {
    throw new Error(`Batch detection failed: ${response.status}`)
  }

  return response.json()
}

export async function runBatch(
  token: string,
  batchId: string,
): Promise<RunBatchResult> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-batches/${batchId}/run`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(`Batch run failed: ${response.status}`)
  }

  return response.json()
}

export async function getBatchStatus(
  token: string,
  batchId: string,
): Promise<RecoveryBatchStatus> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-batches/${batchId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    throw new Error(`Batch status request failed: ${response.status}`)
  }

  return response.json()
}
