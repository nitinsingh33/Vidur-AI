import type { RecoveryAction, RecoveryOutcome } from './recoveryCases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface SubscriptionRecoveryCase {
  id: string
  status: string
  riskLevel: string | null
  revenueAtRisk: string
  recoveryProbability: string | null
  actions: RecoveryAction[]
  outcome: RecoveryOutcome | null
}

export interface Subscription {
  id: string
  externalId: string | null
  amount: string
  currency: string
  status: string
  nextBillingAt: string | null
  failedPaymentCount: number
  createdAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  recoveryCases: SubscriptionRecoveryCase[]
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

export async function getSubscriptions(token: string): Promise<Subscription[]> {
  const response = await fetch(`${API_BASE_URL}/subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface CreateSubscriptionPayload {
  customerId: string
  amount: number
  currency?: string
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  totalCount?: number
}

export interface CreateSubscriptionResult {
  id: string
  externalId: string
  shortUrl: string
  status: string
  amount: number
  currency: string
}

export async function deleteSubscription(
  token: string,
  subscriptionId: string,
): Promise<{ deleted: true; id: string }> {
  const response = await fetch(
    `${API_BASE_URL}/subscriptions/${subscriptionId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function createSubscription(
  token: string,
  payload: CreateSubscriptionPayload,
): Promise<CreateSubscriptionResult> {
  const response = await fetch(`${API_BASE_URL}/subscriptions`, {
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
