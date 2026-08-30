import type { RecoveryAction, RecoveryOutcome } from './recoveryCases'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface InvoiceRecoveryCase {
  id: string
  status: string
  riskLevel: string | null
  revenueAtRisk: string
  recoveryProbability: string | null
  actions: RecoveryAction[]
  outcome: RecoveryOutcome | null
}

export interface Invoice {
  id: string
  amount: string
  currency: string
  status: string
  dueDate: string
  paidAt: string | null
  createdAt: string
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  recoveryCases: InvoiceRecoveryCase[]
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

export async function getInvoices(token: string): Promise<Invoice[]> {
  const response = await fetch(`${API_BASE_URL}/invoices`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface CreateInvoicePayload {
  customerId: string
  amount: number
  currency?: string
  dueDate: string
}

export async function createInvoice(
  token: string,
  payload: CreateInvoicePayload,
): Promise<Invoice> {
  const response = await fetch(`${API_BASE_URL}/invoices`, {
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

export async function markInvoicePaid(
  token: string,
  invoiceId: string,
): Promise<Invoice> {
  const response = await fetch(
    `${API_BASE_URL}/invoices/${invoiceId}/mark-paid`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export interface InvoiceSweepResult {
  scanned: number
  opened: number
  caseIds: string[]
}

export async function runInvoiceSweep(
  token: string,
): Promise<InvoiceSweepResult> {
  const response = await fetch(`${API_BASE_URL}/invoices/sweep-overdue`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
