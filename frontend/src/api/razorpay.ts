import type { RecoveryCase } from './recoveryCases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface RazorpayCheckoutOrder {
  orderId: string
  amount: number
  currency: string
  keyId: string
}

export interface PaymentWithCase {
  id: string
  amount: string
  currency: string
  method: string
  status: string
  failureReason: string | null
  attemptNumber: number
  externalId: string | null
  createdAt: string
  recoveryCases: RecoveryCase[]
}

async function requestJson<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(
      detail?.message ?? `Razorpay request failed: ${response.status}`,
    )
  }

  return response.json()
}

/**
 * Creates a real Razorpay Test Mode order for the caller's merchant
 * (POST /razorpay/checkout). The returned keyId is Razorpay's public key —
 * safe to hand to Checkout.js in the browser; the key secret never leaves
 * the backend.
 */
export function createRazorpayCheckoutOrder(
  token: string,
  payload: { amount: number; customerName?: string },
): Promise<RazorpayCheckoutOrder> {
  return requestJson('/razorpay/checkout', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Polls for the Payment (and RecoveryCase) that the Razorpay
 * payment.failed webhook creates asynchronously, keyed by the real
 * Razorpay payment id. Returns null while the webhook hasn't landed yet
 * (404), so the caller can keep polling.
 */
export async function getPaymentByExternalId(
  token: string,
  externalId: string,
): Promise<PaymentWithCase | null> {
  const response = await fetch(
    `${API_BASE_URL}/payments/by-external-id/${encodeURIComponent(externalId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(
      detail?.message ?? `Payment lookup failed: ${response.status}`,
    )
  }

  return response.json()
}
