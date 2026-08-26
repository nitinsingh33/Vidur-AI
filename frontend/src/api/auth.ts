const API_BASE_URL = 'http://localhost:3000'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

export interface AuthMerchant {
  id: string
  name: string
}

export interface AuthSession {
  accessToken: string
  user: AuthUser
  merchant: AuthMerchant
}

export interface SignupPayload {
  merchantName: string
  name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
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

export async function signup(payload: SignupPayload): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function fetchSession(
  token: string,
): Promise<{ user: AuthUser; merchant: AuthMerchant }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error('Session expired.')
  }

  return response.json()
}

export async function updateProfile(
  token: string,
  name: string,
): Promise<{ user: AuthUser; merchant: AuthMerchant }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
