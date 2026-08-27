const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface Policy {
  id: string
  merchantId: string
  name: string
  description: string | null
  actionType: string
  decision: string
  maxRetries: number | null
  maxContacts: number | null
  maxAmount: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export async function getPolicies(token: string): Promise<Policy[]> {
  const response = await fetch(`${API_BASE_URL}/policies`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Policies request failed: ${response.status}`)
  }

  return response.json()
}
