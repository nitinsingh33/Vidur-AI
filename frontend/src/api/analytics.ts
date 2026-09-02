const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface RevenueAtRiskResponse {
  revenueAtRisk: string
  currency: string
  recoveryCases: number
}

export interface RevenueRecoveredResponse {
  revenueRecovered: string
  currency: string
  successfulRecoveries: number
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

export function getRevenueAtRisk(token: string) {
  return fetchJson<RevenueAtRiskResponse>(
    '/analytics/revenue-at-risk',
    token,
  )
}

export function getRevenueRecovered(token: string) {
  return fetchJson<RevenueRecoveredResponse>(
    '/analytics/revenue-recovered',
    token,
  )
}

export interface AnalyticsSummaryResponse {
  activeRecoveryCases: number
  agentActions: number
  failedActions: number
  escalations: number
}

export function getAnalyticsSummary(token: string) {
  return fetchJson<AnalyticsSummaryResponse>(
    '/analytics/summary',
    token,
  )
}

export interface PaymentHealthDay {
  date: string
  captured: number
  failed: number
  successRate: number | null
}

export interface PaymentHealthReason {
  reason: string
  count: number
}

export interface PaymentHealthMethod {
  method: string
  captured: number
  failed: number
  successRate: number | null
}

export interface PaymentHealthResponse {
  windowDays: number
  daily: PaymentHealthDay[]
  failureReasons: PaymentHealthReason[]
  byMethod: PaymentHealthMethod[]
  currentWindowSuccessRate: number | null
  previousWindowSuccessRate: number | null
}

export function getPaymentHealth(token: string, days = 30) {
  return fetchJson<PaymentHealthResponse>(
    `/analytics/payment-health?days=${days}`,
    token,
  )
}

export interface RecoveryFunnelResponse {
  detected: number
  inProgress: number
  escalated: number
  recovered: number
  exhausted: number
}

export function getRecoveryFunnel(token: string) {
  return fetchJson<RecoveryFunnelResponse>('/analytics/recovery-funnel', token)
}

export interface RiskSignalBreakdownResponse {
  paymentFailure: number
  subscriptionFailure: number
  receivableOverdue: number
  mandateFailure: number
  checkoutAbandonment: number
  promiseToPayPending: number
}

export function getRiskSignalBreakdown(token: string) {
  return fetchJson<RiskSignalBreakdownResponse>(
    '/analytics/risk-signal-breakdown',
    token,
  )
}