const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface AuditLogEntry {
  id: string
  merchantId: string
  recoveryCaseId: string | null
  action: string
  actorType: string
  actorId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

export interface AuditLogResponse {
  data: AuditLogEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getAuditLog(
  token: string,
  page = 1,
  limit = 20,
): Promise<AuditLogResponse> {
  const response = await fetch(
    `${API_BASE_URL}/audit?page=${page}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    throw new Error(`Agent activity request failed: ${response.status}`)
  }

  return response.json()
}

export async function getCaseAuditTrail(
  token: string,
  recoveryCaseId: string,
): Promise<AuditLogEntry[]> {
  const response = await fetch(
    `${API_BASE_URL}/audit/cases/${recoveryCaseId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    throw new Error(`Audit trail request failed: ${response.status}`)
  }

  return response.json()
}
