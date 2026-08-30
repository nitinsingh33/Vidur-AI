Feature #2 — "Diagnose why revenue is at risk": Investigation Report
No files were modified — this is pure code tracing.

1–7: Where the AI/LLM diagnosis lives, and what it actually does
File: agent/app/llm/diagnosis.py


from google import genai
...
client = genai.Client(api_key=config.GEMINI_API_KEY)
response = client.models.generate_content(
    model=config.GEMINI_MODEL,
    contents=prompt,
)
This is a real Gemini API call via the official google-genai SDK (declared in agent/requirements.txt, confirmed importable in this environment) — not a mock, not a canned string.

Model: config.GEMINI_MODEL, read from agent/.env (GEMINI_MODEL=gemini-3.6-flash — set) with a hardcoded fallback of "gemini-3.6-flash" if unset (config.py:13).
API key: GEMINI_API_KEY in agent/.env — present and non-empty (I checked it's set without printing the value).
Data passed in (workflow.py:41-70, assembled by analyze_context): root_cause (the RecoveryCase's rootCause), payment_amount, payment_method, failure_reason, retry_count (attemptNumber), plus recovery_probability (from the ML service, best-effort) and candidate_intervention (the strategy already chosen — see #12).
Prompt (diagnosis.py:24-38): "You are a revenue-recovery analyst... In 2-3 concise, factual sentences, explain why this case is at risk and why the chosen recovery action is appropriate..." followed by the structured context above.
Gemini's return value: response.text — a free-text 2–3 sentence explanation, stripped and returned as str | None. On any exception (bad key, quota, network), it prints a warning and returns None — fails silently, never blocks the pipeline.
8. Where the diagnosis is persisted
recovery.service.ts:58-73 — RiskService-adjacent RecoveryService.recordDiagnosis():


await this.prisma.recoveryCase.update({
  where: { id: recoveryCaseId },
  data: { aiReasoning: reasoning },
});
Triggered by the agent's diagnose_case node POSTing to POST /recovery/cases/:id/diagnosis (workflow.py:160-172), guarded by AgentOrJwtGuard (accepts the x-agent-token shared secret). Also writes an AuditLog entry AI_DIAGNOSIS_GENERATED. It lands in RecoveryCase.aiReasoning — the same column your Phase-1 trace already found unused by Feature #1.

9–10. API + frontend exposure
No dedicated "get diagnosis" endpoint — aiReasoning rides along on the existing GET /recovery-cases/:id (and the list endpoint) response, since it's just a scalar column on RecoveryCase.
RecoveryCaseDetails.tsx:151-170: conditionally renders a card — only if recoveryCase.aiReasoning is truthy — labeled "Vidur AI / AI reasoning" with a Sparkles icon, showing the raw Gemini text.
11. "Root cause: Insufficient Funds" — what is it really?
RecoveryCaseDetails.tsx:143-148:


<span>Root cause</span>
<strong>{formatLabel(recoveryCase.rootCause)}</strong>
recoveryCase.rootCause is set in risk.service.ts:108-109 as payment.failureReason ?? 'PAYMENT_FAILED' — a direct, unmodified copy of the payment's failure reason string. It is set at detection time (Feature #1), long before any Gemini call happens, and never touched again.

Answer: it is (a) — the payment's failureReason, verbatim. It is not Gemini-generated and not derived by any other service. It will show on every case immediately after Feature #1 runs, with or without the agent ever running. The separate "AI reasoning" card (item 10 above) is the only genuinely Gemini-sourced text on this page, and it's absent until the agent workflow completes.

12. Four distinct things, clearly separated
Stage	Service	AI/Deterministic	Triggered by
Risk detection	RiskEngineService.assess()	Deterministic formula (amount × (1−p))	RiskService.assessPayment() (Feature #1, already verified)
Root-cause diagnosis	agent/app/llm/diagnosis.py → Gemini	Real LLM call	diagnose_case node inside the LangGraph, only reachable via POST /recovery/cases/:id/run-agent
Recovery strategy generation	RecoveryStrategyService.determine()	Deterministic switch/lookup table (recovery-strategy.service.ts — 8 hardcoded rootCause → actionType cases), zero AI despite the "Generate Strategy" button's Sparkles icon	POST /recovery/cases/:id/strategy (also called standalone by the "Generate Strategy" button, and internally by the graph's select_intervention node)
Full agent recovery	agent/app/graph/workflow.py build_recovery_graph()	Orchestrates all of the above + policy check + execute + observe, via LangGraph	POST /recovery/cases/:id/run-agent → backend calls POST http://localhost:8001/run-recovery on the Python FastAPI agent service
Critically: diagnosis never influences the decision. The graph calls select_intervention (strategy) before diagnose_case — Gemini narrates a decision already made, it doesn't make one. This is explicit in the code comment at workflow.py:141-147.

Readiness verdict
Code is 100% complete for a live Gemini-backed diagnosis. What I could not verify: whether it actually executes successfully right now, because the agent process isn't running.

Concretely, checked in this environment:

✅ Real google-genai SDK call, not a mock
✅ GEMINI_API_KEY set in agent/.env
✅ GEMINI_MODEL explicitly set (gemini-3.6-flash)
✅ All Python deps (fastapi, langgraph, google-genai, etc.) importable in this environment
✅ The joblib ML model file the FastAPI app loads at import time exists
✅ Persistence path (aiReasoning column, /diagnosis endpoint) and frontend rendering are both wired correctly
❌ The agent FastAPI service is not currently running on port 8001 (I checked — connection refused). I have not personally observed a successful Gemini response come back.
⚠️ I cannot independently confirm "gemini-3.6-flash" is a valid, resolvable model ID for your API key without making a live call — that's the one thing only a real run will prove.
Verdict: PARTIALLY IMPLEMENTED — not because any logic is missing, but strictly because nothing here has been runtime-verified yet (same category of gap as the backend/frontend before I started them for you last time). One successful run-agent call would upgrade this to LIVE GEMINI DIAGNOSIS WORKING. I did not start the agent service in this turn since you asked for investigation only — say the word and I'll bring it up and run the real end-to-end check the same way I did for Feature #1.

Exact UI action to demonstrate Feature #2
Open the existing VIDUR-DEMO recovery case: Recovery Cases → click the case → Recovery Case Details (/recovery-cases/:id).
In the "Vidur AI / Recovery intelligence" panel, click "Run Full Agent Recovery" (outline button, Bot icon — not "Generate Strategy", which only exercises the deterministic strategy table).
Wait for it to finish ("Agent is running full recovery workflow...") — this requires the agent FastAPI service to be up on localhost:8001 and reachable from the backend.
The page auto-reloads on completion; a new "AI reasoning" card (Sparkles icon, "Vidur AI" label) appears above the recovery panel with Gemini's 2–3 sentence explanation — that card's presence is the live proof, since it renders null until aiReasoning is actually persisted.
Point the judge at the contrast: the "Root cause" tile above it was already there before this click (from Feature #1) — the new card is the only thing this step adds.