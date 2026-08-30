import type { RecoveryCase } from './recoveryCases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface DemoPayment {
  id: string
  amount: string
  currency: string
  method: string
  status: string
  failureReason: string | null
  attemptNumber: number
  externalId: string | null
  createdAt: string
}

export interface TriggerDemoFailurePayload {
  amount: number
  failureReason?: string
  method?: string
  customerName?: string
}

export interface TriggerDemoFailureResponse {
  payment: DemoPayment
  recoveryCase: RecoveryCase
}

export interface DemoResetResponse {
  paymentsDeleted: number
  recoveryCasesDeleted: number
  auditLogsDeleted: number
}

async function postJson<T>(
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(
      detail?.message ?? `Demo request failed: ${response.status}`,
    )
  }

  return response.json()
}

export function triggerDemoPaymentFailure(
  token: string,
  payload: TriggerDemoFailurePayload,
): Promise<TriggerDemoFailureResponse> {
  return postJson('/demo/payment-failure', token, payload)
}

export function resetDemo(token: string): Promise<DemoResetResponse> {
  return postJson('/demo/reset', token)
}
