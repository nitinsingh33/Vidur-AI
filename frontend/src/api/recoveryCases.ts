const API_BASE_URL = 'http://localhost:3000'

export interface RecoveryAction {
  id: string
  type: string
  status: string
  reason: string | null
  policyDecision: string | null
  attemptedAt: string | null
  completedAt: string | null
  createdAt: string

  result: {
    message?: string
    successful?: boolean
    escalated?: boolean
  } | null
}

export interface PaymentEvent {
  id: string
  type: string
  occurredAt: string
  metadata?: Record<string, unknown> | null
}

export interface RecoveryOutcome {
  id: string
  recoveredAmount: string
  successful: boolean
  recoveryMethod: string | null
  recoveredAt: string | null
  createdAt: string
}

export interface RecoveryCase {
  id: string
  status: string
  riskLevel: string
  revenueAtRisk: string
  recoveryProbability: string
  rootCause: string | null

  customer: {
    id: string
    name: string
    email: string
    phone?: string | null
  }

  payment: {
    id: string
    amount: string
    currency: string
    method: string
    status: string
    failureReason: string | null
    attemptNumber: number
    events?: PaymentEvent[]
  } | null

  invoice?: Record<string, unknown> | null

  actions: RecoveryAction[]

  outcome?: RecoveryOutcome | null
}

export interface RecoveryCasesResponse {
  data: RecoveryCase[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export async function getRecoveryCases(
  page = 1,
  limit = 5,
): Promise<RecoveryCasesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-cases?page=${page}&limit=${limit}`,
  )

  if (!response.ok) {
    throw new Error(
      `Recovery cases request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function getRecoveryCase(
  recoveryCaseId: string,
): Promise<RecoveryCase> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-cases/${recoveryCaseId}`,
  )

  if (!response.ok) {
    throw new Error(
      `Recovery case request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function createRecoveryStrategy(
  recoveryCaseId: string,
): Promise<RecoveryAction> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/strategy`,
    {
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(
      `Strategy request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function executeRecoveryAction(
  recoveryCaseId: string,
): Promise<RecoveryAction> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/execute`,
    {
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(
      `Recovery execution failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function observeRecovery(
  recoveryCaseId: string,
): Promise<RecoveryOutcome> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/observe`,
    {
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(
      `Recovery observation failed: ${response.status}`,
    )
  }

  return response.json()
}
export interface AgentRecoveryResult {
  recovery_case_id: string
  success: boolean | null
  policy_decision: string | null
  candidate_intervention: string | null
}

export async function runAgentRecovery(
  recoveryCaseId: string,
): Promise<AgentRecoveryResult> {
  const response = await fetch('http://localhost:8001/run-recovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recovery_case_id: recoveryCaseId }),
  })

  if (!response.ok) {
    throw new Error(`Agent recovery failed: ${response.status}`)
  }

  return response.json()
}
