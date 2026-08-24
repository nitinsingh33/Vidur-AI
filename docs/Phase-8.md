The most important phase

Absolutely. **Phase 8 is the core of RecoverAI**, so we should be much stricter here than in the previous phases.

We already have all the pieces LangGraph needs:

```text
Phase 4 → Recovery risk
Phase 5 → Deterministic strategies
Phase 6 → ML recovery probability
Phase 7 → Python ML service
                    ↓
              Phase 8 Agent
```

And the LangGraph we're building is specifically:

```text
START
  ↓
Load Recovery Case
  ↓
Analyze Context
  ↓
Root Cause
  ↓
Get Recovery Probability
  ↓
Select Intervention
  ↓
Policy Check
  ↓
Execute
  ↓
Observe
  ↓
Success?
 ┌───────┴────────┐
YES              NO
 │                │
 ▼                ▼
Recover       Retry/Escalate
```

### One important architectural decision

We should **not throw away our existing deterministic components and ask an LLM to do everything**.

Instead:

```text
                 LangGraph
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
   Recovery      ML Service    Policies
    Rules         :8001        PostgreSQL
        │           │            │
        └───────────┼────────────┘
                    ▼
              Agent Decision
```

LangGraph is the **orchestrator/state machine**.

It decides **when to call what**, maintains state, handles branching, and allows us to observe/retry/escalate.

It should **not hallucinate a payment status, invent a recovery case, or bypass policy**.

---

## Phase 8 implementation order

We're going to build this incrementally:

### 8.1 — Agent state

Define the state that travels through the graph:

```text
recoveryCase
rootCause
recoveryProbability
candidateIntervention
policyDecision
executionResult
success
attempt
```

### 8.2 — Load Recovery Case

LangGraph receives:

```text
recoveryCaseId
```

and loads the real case from the existing backend/database.

### 8.3 — Analyze Context + Root Cause

Use the existing RecoveryCase/payment/customer information.

**No LLM yet if deterministic data already gives us the answer.**

### 8.4 — Get ML probability

Call the existing:

```text
FastAPI
POST /predict-recovery
```

rather than loading the model again.

### 8.5 — Select Intervention

Initially use our existing Phase-5 strategy engine.

This gives the agent a reliable baseline.

### 8.6 — Policy Check

Use the existing `Policy` model.

This is extremely important because:

```text
Agent decision ≠ permission to execute
```

The policy layer remains authoritative.

### 8.7 — Execute

For Phase 8's first implementation, we'll create **safe simulated execution**, not actually charge a card/send WhatsApp/email.

For example:

```text
RETRY_PAYMENT
     ↓
executionResult
     ↓
simulated success/failure
```

We can later replace that node with real adapters.

### 8.8 — Observe

Read the execution result and branch:

```text
success = true
     ↓
RECOVERED

success = false
     ↓
RETRY / ESCALATE
```

---

# Very important: where LangChain fits

You said "LangGraph", and that's correct.

We don't need to blindly add LangChain everywhere.

The distinction is:

```text
LangChain
    ↓
LLM/tool integration

LangGraph
    ↓
Stateful workflow + branching + orchestration
```

For **our current graph**, LangGraph is the important piece.

Later, if we introduce an LLM node for contextual reasoning, LangChain components can support that node.

---

# First thing we do

**Do not install anything yet.**

Because Phase 8 is much more architecture-sensitive than Phase 6/7, I want to inspect the current project state before adding dependencies.

Run these from the project root:

```powershell
Get-ChildItem agent -Recurse | Select-Object FullName
```

and:

```powershell
Get-Content agent/requirements.txt
```

and:

```powershell
Get-Content backend/src/recovery/recovery.service.ts
```

and:

```powershell
Get-Content backend/src/risk/risk-engine.service.ts
```

Also:

```powershell
Get-Content backend/src/recovery/recovery-strategy.service.ts
```

**Send those outputs.**

I specifically want the actual current implementations of the Recovery Service, Risk Engine, and Strategy Service before we wire them into LangGraph. That prevents us from accidentally duplicating or changing logic that we already verified in Phases 4–7.

Then we'll build **Phase 8.1 — LangGraph state + graph skeleton**, and test each node one by one.

No giant implementation dump. **One verified step at a time.**

Phase 8.1
[✅] LangGraph installed
[✅] Agent state defined
[✅] Graph created
[✅] Nodes defined
[✅] Graph edges defined
[✅] START → END execution verified


LangGraph
   ↓
NestJS /ml-features
   ↓
REAL historical features
   ↓
FastAPI
   ↓
ML model
   ↓
probability

phase-8 status
[✅] LangGraph skeleton
[✅] Load RecoveryCase
[✅] Analyze context
[✅] Real ML feature aggregation
[✅] NestJS → FastAPI
[✅] FastAPI → ML
[✅] ML → LangGraph
[✅] Select intervention
[✅] Policy check
[⏳] Execute
[⏳] Observe
[⏳] Success → Recover / Retry → Escalate

Next: Phase 8.5 — Select Intervention

Crucially, we're not going to ask an LLM to invent the intervention.

We already have the verified Phase-5 deterministic strategy:

INSUFFICIENT_FUNDS
        ↓
RETRY_PAYMENT

LangGraph's job is now to orchestrate that existing strategy using the context + ML signal.

The next node will therefore:

rootCause
    +
recovery_probability
    ↓
Select Intervention

For our current case, we should get:

rootCause = INSUFFICIENT_FUNDS
probability = 0.8694
        ↓
RETRY_PAYMENT