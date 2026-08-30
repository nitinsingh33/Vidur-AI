const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface CheckoutSweepResult {
  scanned: number
  opened: number
  caseIds: string[]
}

export async function runCheckoutSweep(
  token: string,
): Promise<CheckoutSweepResult> {
  const response = await fetch(`${API_BASE_URL}/checkout-sweep/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Checkout sweep failed: ${response.status}`)
  }

  return response.json()
}
