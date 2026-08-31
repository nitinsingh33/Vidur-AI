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
  retryIntervalMinutes: number | null
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

export interface UpdatePolicyPayload {
  decision?: string
  maxRetries?: number | null
  maxContacts?: number | null
  maxAmount?: number | null
  retryIntervalMinutes?: number | null
  enabled?: boolean
}

export async function updatePolicy(
  token: string,
  policyId: string,
  updates: UpdatePolicyPayload,
): Promise<Policy> {
  const response = await fetch(`${API_BASE_URL}/policies/${policyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    let message = `Policy update failed: ${response.status}`
    try {
      const body = await response.json()
      if (typeof body.message === 'string') message = body.message
    } catch {
      // fall through to status-based message
    }
    throw new Error(message)
  }

  return response.json()
}
