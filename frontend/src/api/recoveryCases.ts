const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

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
    paymentLinkId?: string
    paymentLinkShortUrl?: string
    /** Present only for SEND_VOICE_MESSAGE — a real Gemini-generated
     *  Hinglish script and Gemini-synthesized audio, never a placed call. */
    voiceScript?: string
    voiceAudioBase64?: string
    voiceAudioMimeType?: string
  } | null

  externalReferenceId?: string | null
  externalReferenceUrl?: string | null
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
  aiReasoning?: string | null

  customer: {
    id: string
    name: string
    email: string
    phone?: string | null
  } | null

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

  invoice?: {
    id: string
    amount: string
    currency: string
    status: string
    dueDate: string
  } | null

  order?: {
    id: string
    amount: string
    currency: string
    status: string
    createdAt: string
  } | null

  subscription?: {
    id: string
    amount: string
    currency: string
    status: string
    failedPaymentCount: number
    nextBillingAt: string | null
  } | null

  mandate?: {
    id: string
    method: string
    maxAmount: string
    currency: string
    status: string
    failedDebitCount: number
  } | null

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

export interface GetRecoveryCasesOptions {
  page?: number
  limit?: number
  status?: string
  riskLevel?: string
  rootCause?: string
}

export async function getRecoveryCases(
  token: string,
  options: GetRecoveryCasesOptions = {},
): Promise<RecoveryCasesResponse> {
  const { page = 1, limit = 5, status, riskLevel, rootCause } = options

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (status) params.set('status', status)
  if (riskLevel) params.set('riskLevel', riskLevel)
  if (rootCause) params.set('rootCause', rootCause)

  const response = await fetch(
    `${API_BASE_URL}/recovery-cases?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    throw new Error(
      `Recovery cases request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function getRecoveryCase(
  token: string,
  recoveryCaseId: string,
): Promise<RecoveryCase> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-cases/${recoveryCaseId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (!response.ok) {
    throw new Error(
      `Recovery case request failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function deleteRecoveryCase(
  token: string,
  recoveryCaseId: string,
): Promise<{ deleted: true; id: string }> {
  const response = await fetch(
    `${API_BASE_URL}/recovery-cases/${recoveryCaseId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(
      detail?.message ?? `Delete recovery case failed: ${response.status}`,
    )
  }

  return response.json()
}

export async function createRecoveryStrategy(
  token: string,
  recoveryCaseId: string,
): Promise<RecoveryAction> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/strategy`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(
      `Strategy request failed: ${response.status}`,
    )
  }

  return response.json()
}

export interface PolicyCheckResult {
  decision: string
  policyId: string
  reason: string
}

/**
 * The manual "Generate strategy -> review -> Execute" flow must call this
 * itself before execute — unlike the autonomous agent run (which evaluates
 * policy as one of its own graph steps), nothing else does this for a
 * manually-generated action, and /execute will refuse to run anything whose
 * policyDecision hasn't been set to ALLOW.
 */
export async function checkPolicy(
  token: string,
  recoveryCaseId: string,
  actionType: string,
): Promise<PolicyCheckResult> {
  const response = await fetch(
    `${API_BASE_URL}/policies/check/${recoveryCaseId}/${actionType}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(`Policy check failed: ${response.status}`)
  }

  return response.json()
}

export async function executeRecoveryAction(
  token: string,
  recoveryCaseId: string,
): Promise<RecoveryAction> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/execute`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
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
  token: string,
  recoveryCaseId: string,
): Promise<RecoveryOutcome> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/observe`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
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
  ai_reasoning: string | null
}

export async function runAgentRecovery(
  token: string,
  recoveryCaseId: string,
): Promise<AgentRecoveryResult> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/run-agent`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(`Agent recovery failed: ${response.status}`)
  }

  return response.json()
}

async function parseErrorMessage(response: Response) {
  try {
    const body = await response.json()
    if (typeof body.message === 'string') return body.message
  } catch {
    // fall through to status-based message
  }
  return `Request failed: ${response.status}`
}

export async function approveRecoveryAction(
  token: string,
  recoveryCaseId: string,
  actionId: string,
): Promise<RecoveryAction> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/actions/${actionId}/approve`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}

export async function rejectRecoveryAction(
  token: string,
  recoveryCaseId: string,
  actionId: string,
): Promise<RecoveryAction> {
  const response = await fetch(
    `${API_BASE_URL}/recovery/cases/${recoveryCaseId}/actions/${actionId}/reject`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response))
  }

  return response.json()
}
