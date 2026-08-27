const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface Merchant {
  id: string
  name: string
  email: string
}

export interface MerchantProfile extends Merchant {
  currency: string
  createdAt: string
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
