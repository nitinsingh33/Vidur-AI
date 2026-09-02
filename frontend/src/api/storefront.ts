const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface StorefrontMerchant {
  id: string
  name: string
  currency: string
  slug: string
}

export interface StorefrontProduct {
  id: string
  merchantId: string
  name: string
  description: string | null
  imageUrl: string | null
  priceAmount: string
  currency: string
  active: boolean
}

export interface StorefrontResponse {
  merchant: StorefrontMerchant
  products: StorefrontProduct[]
}

export interface StorefrontOrder {
  orderId: string
  internalOrderId: string
  amount: number
  currency: string
  keyId: string
}

export interface StorefrontOrderStatus {
  status: 'CREATED' | 'PAID' | 'FAILED' | 'CANCELLED'
  recovery: { actionType: string; paymentLinkUrl: string } | null
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(
      detail?.message ?? `Storefront request failed: ${response.status}`,
    )
  }

  return response.json()
}

export function getStorefront(slug: string): Promise<StorefrontResponse> {
  return requestJson(`/storefront/${encodeURIComponent(slug)}`)
}

export function getStorefrontProduct(
  slug: string,
  productId: string,
): Promise<{ merchant: StorefrontMerchant; product: StorefrontProduct }> {
  return requestJson(
    `/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}`,
  )
}

export interface CheckoutCartItem {
  productId: string
  quantity: number
}

export function createStorefrontOrder(
  slug: string,
  payload: {
    items: CheckoutCartItem[]
    customer: { name: string; email: string; phone?: string }
  },
): Promise<StorefrontOrder> {
  return requestJson(`/storefront/${encodeURIComponent(slug)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Fired on tab close/hide from the checkout page before payment completed —
 * a real browser signal, not a guess. Uses sendBeacon so it fires reliably
 * even as the page is unloading; falls back to a fire-and-forget fetch for
 * browsers/contexts where sendBeacon isn't available.
 */
export function sendAbandonSignal(internalOrderId: string) {
  const url = `${API_BASE_URL}/storefront/orders/${encodeURIComponent(internalOrderId)}/abandon-signal`

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([], { type: 'application/json' }))
    return
  }

  void fetch(url, { method: 'POST', keepalive: true })
}

export interface StorefrontSubscription {
  shortUrl: string
}

/**
 * FashionKart Plus — no amount/plan in the payload: it's a single fixed
 * membership tier priced server-side, never taken from the client. Returns
 * a real Razorpay-hosted shortUrl the customer completes on Razorpay's own
 * page, the same "hosted redirect" flow as a Payment Link — not a
 * Checkout.js modal.
 */
export function createStorefrontSubscription(
  slug: string,
  payload: { customer: { name: string; email: string; phone?: string } },
): Promise<StorefrontSubscription> {
  return requestJson(`/storefront/${encodeURIComponent(slug)}/subscribe`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getStorefrontOrderStatus(
  internalOrderId: string,
): Promise<StorefrontOrderStatus> {
  return requestJson(
    `/storefront/orders/${encodeURIComponent(internalOrderId)}/status`,
  )
}
