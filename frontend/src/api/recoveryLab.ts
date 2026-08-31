const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface LaunchScenarioResult {
  scenario: string
  recoveryCaseId: string | null
  instructions: string
  [key: string]: unknown
}

async function post(
  path: string,
  token: string,
  body: { amount?: number; customerName?: string; promisedInMinutes?: number },
): Promise<LaunchScenarioResult> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(
      detail?.message ?? `Recovery Lab request failed: ${response.status}`,
    )
  }

  return response.json()
}

export function launchPaymentFailure(token: string, body: { amount?: number; customerName?: string } = {}) {
  return post('/recovery-lab/payment-failure', token, body)
}

export function launchCheckoutAbandonment(token: string, body: { amount?: number; customerName?: string } = {}) {
  return post('/recovery-lab/checkout-abandonment', token, body)
}

export function launchSubscriptionFailure(token: string, body: { amount?: number; customerName?: string } = {}) {
  return post('/recovery-lab/subscription-failure', token, body)
}

export function launchInvoiceOverdue(token: string, body: { amount?: number; customerName?: string } = {}) {
  return post('/recovery-lab/invoice-overdue', token, body)
}

export function launchMandateFailure(token: string, body: { amount?: number; customerName?: string } = {}) {
  return post('/recovery-lab/mandate-failure', token, body)
}

export function launchPromiseToPay(
  token: string,
  body: { amount?: number; customerName?: string; promisedInMinutes?: number } = {},
) {
  return post('/recovery-lab/promise-to-pay', token, body)
}
