export const RAZORPAY_CHECKOUT_SCRIPT_SRC =
  'https://checkout.razorpay.com/v1/checkout.js'

export interface RazorpayFailureResponse {
  error: {
    code?: string
    description?: string
    reason?: string
    metadata?: { order_id?: string; payment_id?: string }
  }
}

export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name?: string
  description?: string
  /** Set for mandate-registration orders (token/recurring-payment orders). */
  recurring?: boolean
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
  handler?: (response: { razorpay_payment_id: string }) => void
}

export interface RazorpayInstance {
  open: () => void
  on: (
    event: 'payment.failed',
    handler: (response: RazorpayFailureResponse) => void,
  ) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

export function loadRazorpayCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()

  const existing = document.querySelector(
    `script[src="${RAZORPAY_CHECKOUT_SCRIPT_SRC}"]`,
  )

  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Razorpay Checkout script.')),
      )
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = RAZORPAY_CHECKOUT_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error('Failed to load Razorpay Checkout script.'))
    document.body.appendChild(script)
  })
}
