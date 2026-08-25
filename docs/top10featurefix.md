Exactly. **We should not randomly start modifying files.** We will work like a controlled engineering upgrade:

**inspect → understand existing flow → identify integration points → modify minimum necessary files → add only required files → run/verify → move to next feature.**

We will **not redesign the project from scratch**, and we will not introduce a new architecture unless the existing architecture genuinely cannot support the requirement.

# Top 10 missing features — priority order

These are the 10 pieces I would fix first, in this exact order.

| Priority | Missing functionality                                           | Why it matters                                                                 |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **1**    | **Case-specific real recovery execution**                       | Core Razorpay requirement: agent must actually execute the chosen intervention |
| **2**    | **Complete bounded retry → observe → retry/stop/escalate loop** | Satisfies bounded recovery + stopping rules                                    |
| **3**    | **Real intervention executors for all important strategies**    | Strategy selection is useless if only `RETRY_PAYMENT` can execute              |
| **4**    | **Complete policy/guardrail enforcement**                       | Prevents unsafe/unlimited agent actions                                        |
| **5**    | **Full audit trail for every agent decision/action**            | Explicit Razorpay requirement; fintech-grade traceability                      |
| **6**    | **Real agent reasoning/decision evidence**                      | Strengthens Razorpay's “AI judgment” criterion                                 |
| **7**    | **Multi-scenario revenue-risk detection pipeline**              | Expand beyond only failed-payment cases                                        |
| **8**    | **True batch recovery orchestration + batch metrics**           | Razorpay explicitly asks for measured recovery “across a batch”                |
| **9**    | **Failure simulation + recovery verification/evaluation**       | Lets us prove the system works under failures, not only happy paths            |
| **10**   | **Final end-to-end demo workflow/UI**                           | Turns all backend capability into a convincing Razorpay demo                   |

---

# The dependency order matters

We should **not** start with #6 AI reasoning or #10 UI.

For example, there is no point making the UI show:

> “AI decided to retry payment”

when the system cannot actually execute the retry correctly.

The correct progression is:

```text
1. REAL EXECUTION
       ↓
2. RETRY / STOP / ESCALATE LOOP
       ↓
3. ALL IMPORTANT ACTION TYPES
       ↓
4. GUARDRAILS
       ↓
5. AUDIT
       ↓
6. AI DECISION EVIDENCE
       ↓
7. MULTI-SCENARIO DETECTION
       ↓
8. BATCH
       ↓
9. FAILURE TESTING
       ↓
10. FINAL DEMO
```

---

# FEATURE #1 — We start here

## **Case-specific recovery execution**

This is the first thing I want to fix.

Currently the biggest architectural weakness is roughly:

```text
Recovery Case
      ↓
Agent chooses strategy
      ↓
Execution
      ↓
hardcoded/test payment context
```

We need:

```text
Recovery Case
      ↓
Agent
      ↓
Strategy
      ↓
Policy Gate
      ↓
CASE-SPECIFIC EXECUTOR
      ↓
Actual/simulated bounded recovery action
      ↓
Outcome
      ↓
Audit
```

The key word is:

# **CASE-SPECIFIC**

The agent must execute the action against the **actual recovery case being processed**, not some hardcoded test order.

---

# Before touching any code

You specifically said:

> “do not assume anything”

So I am **not going to tell you to change `workflow.py`, `RecoveryService`, etc. yet**.

First I want to inspect the exact current implementation in your latest code.

For Feature #1, send me the following.

## A. Current folder structure

Please send the output of:

```powershell
tree /F backend
```

and:

```powershell
tree /F agent
```

and, because we'll eventually need to connect the execution result to the UI:

```powershell
tree /F frontend
```

You can limit it to relevant source folders if the output is huge.

For example, these are enough:

```text
backend/src/...
agent/...
frontend/src/...
```

---

# B. Backend files

Send the **complete contents** of these files from your current project:

### 1. Prisma schema

```text
backend/prisma/schema.prisma
```

### 2. Recovery case service

The file containing:

```text
RecoveryCaseService
```

### 3. Recovery action / execution service

The file containing:

```text
RecoveryService
```

especially the current:

```text
executeRecoveryAction()
observeRecovery()
```

### 4. Recovery case controller

The controller exposing the recovery-case APIs.

### 5. Payment-related service/tool

The exact file(s) that currently handle:

```text
payment execution
Razorpay interaction
retry payment
```

---

# C. Agent files

Send the exact files currently responsible for the agent workflow.

I specifically want:

### 6. `workflow.py`

The complete file.

### 7. Agent tool definitions

The complete file(s) containing things like:

```text
PaymentTool
EscalationTool
Recovery tools
```

### 8. Agent API entry point

The FastAPI file that exposes something like:

```text
/run-recovery
```

---

# D. Configuration that connects the agent to backend

Send:

### 9. Agent `.env.example` / configuration file

**Do NOT send real API keys, secrets, passwords or tokens.**

I only need variable names such as:

```text
BACKEND_URL=
RAZORPAY_KEY_ID=
...
```

with values redacted.

### 10. Relevant Docker/compose configuration

Only the file that connects:

```text
backend
agent
postgres
redis
```

For example, if you have:

```text
docker-compose.yml
```

send that.

---

# What I will do after you send these

I will **not immediately rewrite code**.

First I will create a Feature #1 implementation map:

```text
CURRENT FLOW

RecoveryCase
     ↓
?
     ↓
?
     ↓
?
```

Then:

```text
TARGET FLOW

RecoveryCase
     ↓
Strategy
     ↓
Policy
     ↓
Case-specific Executor
     ↓
Action Result
     ↓
Recovery Outcome
```

Then I will identify exactly:

### Existing files to MODIFY

### Existing functions to EXTEND

### New files, only if genuinely necessary

### Files we should NOT touch

### Database changes, if any

### API changes, if any

### Agent changes, if any

### Frontend changes, if any

Only **after that** will I give you the implementation steps/code.

---

# Very important: we will preserve the existing architecture

I do **not** want us to do this:

```text
Current project
     ↓
throw everything away
     ↓
new agent architecture
```

We will do this:

```text
Current project
     ↓
understand existing contracts
     ↓
patch missing functionality
     ↓
preserve existing APIs where possible
     ↓
add capability
```

That reduces the chance of breaking the 60% that already works.

---

# How we will verify Feature #1

We won't mark it “done” merely because the code compiles.

It will have to pass something like:

```text
[ ] Case A enters recovery
[ ] Agent gets Case A's actual identifiers
[ ] Strategy selected for Case A
[ ] Policy evaluated
[ ] Correct executor invoked
[ ] Executor receives Case A's data
[ ] Action result returned
[ ] Recovery outcome generated
[ ] Correct amount attributed to Case A
[ ] No hardcoded order/customer/payment IDs
[ ] Failure path is handled
[ ] Existing flows still work
```

Then we'll explicitly say:

# FEATURE 1 — PASS ✅

or

# FEATURE 1 — PARTIAL ⚠️

We don't move to Feature #2 until Feature #1 is genuinely verified.

---

## Send me first

Start with these three tree outputs:

```powershell
tree /F backend\src
tree /F agent
tree /F frontend\src
```

Then send the **backend recovery files + `agent/workflow.py` + agent tool files** listed above.

**Don't start changing code yet.** Once I have those, I will first reconstruct the exact existing Feature #1 flow and tell you precisely which files we need to modify/add.


Feature-1 implemented - 28/8/26