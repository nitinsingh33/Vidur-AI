const API_BASE_URL = 'http://localhost:3000'

export interface Merchant {
  id: string
  name: string
  email: string
}

export async function getMerchants(): Promise<Merchant[]> {
  const response = await fetch(`${API_BASE_URL}/merchants`)

  if (!response.ok) {
    throw new Error(`Merchants request failed: ${response.status}`)
  }

  return response.json()
}
