const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  createdAt: string
}

async function parseErrorMessage(response: Response) {
  try {
    const body = await response.json()
    if (Array.isArray(body.message)) return body.message.join(' ')
    if (typeof body.message === 'string') return body.message
  } catch {
    // fall through to status-based message
  }
  return `Request failed: ${response.status}`
}

export async function getCustomers(token: string): Promise<Customer[]> {
  const response = await fetch(`${API_BASE_URL}/customers`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface CreateCustomerPayload {
  name: string
  email?: string
  phone?: string
}

export async function createCustomer(
  token: string,
  payload: CreateCustomerPayload,
): Promise<Customer> {
  const response = await fetch(`${API_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
