import type { RecoveryAction, RecoveryOutcome } from './recoveryCases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface PromiseRecoveryCase {
  id: string
  status: string
  riskLevel: string | null
  revenueAtRisk: string
  actions: RecoveryAction[]
  outcome: RecoveryOutcome | null
}

export interface PromiseToPay {
  id: string
  merchantId: string
  recoveryCaseId: string
  invoiceId: string
  customerId: string
  promisedAmount: string
  promisedDate: string
  status: 'PENDING' | 'KEPT' | 'MISSED'
  source: string
  notes: string | null
  recoveredAmount: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  invoice: {
    id: string
    amount: string
    currency: string
    status: string
    dueDate: string
  }
  recoveryCase: PromiseRecoveryCase
}

async function parseErrorMessage(response: Response) {
  try {
    const body = await response.json()
    if (Array.isArray(body.message)) return body.message.join(' ')
    if (typeof body.message === 'string') return body.message
  } catch {
    // fall through to status-based message
  }
  return `Request failed: ${response.status}`
}

export async function getPromises(token: string): Promise<PromiseToPay[]> {
  const response = await fetch(`${API_BASE_URL}/promises`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function getPromise(
  token: string,
  promiseId: string,
): Promise<PromiseToPay> {
  const response = await fetch(`${API_BASE_URL}/promises/${promiseId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface CreatePromisePayload {
  recoveryCaseId: string
  promisedAmount: number
  promisedDate: string
  notes?: string
}

export async function createPromise(
  token: string,
  payload: CreatePromisePayload,
): Promise<PromiseToPay> {
  const response = await fetch(`${API_BASE_URL}/promises`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface PromiseSweepResult {
  scanned: number
  kept: number
  missed: number
}

export async function runPromiseSweep(
  token: string,
): Promise<PromiseSweepResult> {
  const response = await fetch(`${API_BASE_URL}/promises/sweep-now`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
