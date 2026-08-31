import type { RecoveryAction, RecoveryOutcome } from './recoveryCases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface MandateRecoveryCase {
  id: string
  status: string
  riskLevel: string | null
  revenueAtRisk: string
  recoveryProbability: string | null
  actions: RecoveryAction[]
  outcome: RecoveryOutcome | null
}

export interface Mandate {
  id: string
  externalId: string | null
  registrationOrderId: string
  method: string
  maxAmount: string
  currency: string
  frequency: string
  status: string
  expireAt: string | null
  failedDebitCount: number
  lastAttemptAt: string | null
  createdAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  recoveryCases: MandateRecoveryCase[]
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

export async function getMandates(token: string): Promise<Mandate[]> {
  const response = await fetch(`${API_BASE_URL}/mandates`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface CreateMandatePayload {
  customerId: string
  maxAmount: number
  currency?: string
  method?: 'upi' | 'emandate'
  frequency?: string
  validForMonths?: number
}

export interface CreateMandateResult {
  id: string
  registrationOrderId: string
  amount: number
  currency: string
  keyId: string
  method: 'upi' | 'emandate'
}

export async function createMandate(
  token: string,
  payload: CreateMandatePayload,
): Promise<CreateMandateResult> {
  const response = await fetch(`${API_BASE_URL}/mandates`, {
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

export interface MandateSequencerResult {
  scanned: number
  attempted: number
  skipped: number
}

export async function runMandateRetrySequencer(
  token: string,
): Promise<MandateSequencerResult> {
  const response = await fetch(
    `${API_BASE_URL}/mandates/run-retry-sequencer`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
