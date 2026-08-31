const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface Merchant {
  id: string
  name: string
  email: string
}

export interface MerchantProfile extends Merchant {
  currency: string
  createdAt: string
  /** Not secret — Razorpay's own Checkout.js already exposes this client-side. */
  razorpayKeyId: string | null
  /** True once a Key Secret + Webhook Secret have been saved. The secrets
   *  themselves are never returned by any endpoint. */
  razorpayConnected: boolean
}

async function parseErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json()
    if (typeof body.message === 'string') return body.message
    if (Array.isArray(body.message)) return body.message.join(', ')
  } catch {
    // fall through
  }
  return fallback
}

export async function getMerchants(token: string): Promise<Merchant[]> {
  const response = await fetch(`${API_BASE_URL}/merchants`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Merchants request failed: ${response.status}`)
  }

  return response.json()
}

export async function getMyMerchant(token: string): Promise<MerchantProfile> {
  const response = await fetch(`${API_BASE_URL}/merchants/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Merchant profile request failed: ${response.status}`)
  }

  return response.json()
}

export async function updateMyMerchant(
  token: string,
  name: string,
): Promise<Merchant> {
  const response = await fetch(`${API_BASE_URL}/merchants/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(`Merchant update failed: ${response.status}`)
  }

  return response.json()
}

export interface ConnectRazorpayPayload {
  keyId: string
  keySecret: string
  webhookSecret: string
}

/**
 * Submits a merchant's own Razorpay credentials. The backend verifies them
 * with a real Razorpay API call before saving anything — a rejected request
 * here means Razorpay itself did not accept the Key ID/Secret, not a bug.
 * Only a masked/boolean connection status ever comes back; the secrets
 * themselves are never echoed.
 */
export async function connectRazorpay(
  token: string,
  payload: ConnectRazorpayPayload,
): Promise<MerchantProfile> {
  const response = await fetch(`${API_BASE_URL}/merchants/me/razorpay-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(
        response,
        `Connecting Razorpay failed: ${response.status}`,
      ),
    )
  }

  return response.json()
}

export async function disconnectRazorpay(token: string): Promise<MerchantProfile> {
  const response = await fetch(`${API_BASE_URL}/merchants/me/razorpay-credentials`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(
        response,
        `Disconnecting Razorpay failed: ${response.status}`,
      ),
    )
  }

  return response.json()
}
