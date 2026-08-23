# VidurAI — Agentic Revenue Recovery Orchestrator

> An AI-powered revenue recovery agent that detects revenue at risk, diagnoses the root cause, selects the right intervention, executes bounded recovery workflows, and measures the money actually recovered.

## 🚀 Problem

Revenue does not disappear through a single failure.

Businesses lose money through:

* Failed payments
* Checkout abandonment
* Failed subscriptions
* Overdue receivables
* Failed mandates
* Repeated payment degradation

Traditional systems generally identify these events but leave the next steps to humans or static retry rules.

RecoverAI closes this loop.

```text
Detect → Diagnose → Decide → Validate → Execute → Observe → Recover
```

## 🎯 Razorpay Buildathon Track

**Track 03 — AI Revenue Recovery**

The objective is to build an agent that detects revenue at risk, determines the appropriate intervention, and executes a bounded recovery workflow while demonstrating measurable money recovered across a batch.

## 💡 Solution

RecoverAI is an agentic revenue recovery orchestration system.

Instead of applying the same recovery action to every failed transaction, the system combines:

* Transaction context
* Customer history
* Payment failure reason
* Recovery probability
* Business policies
* Previous interventions
* Customer value
* Recovery history

to determine the most appropriate intervention.

### Example

```text
Payment Failed
      ↓
Root Cause Analysis
      ↓
Insufficient Funds
      ↓
Recovery Probability = 87%
      ↓
Retry + Reminder
      ↓
Policy Validation
      ↓
Action Executed
      ↓
Payment Successful
      ↓
₹2,999 Recovered
```

## 🧠 Core Architecture

```text
                         ┌─────────────────┐
                         │ Merchant        │
                         │ Dashboard       │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ NestJS API      │
                         └────────┬────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
             ▼                    ▼                    ▼
      Revenue Risk          Agent Engine          Analytics
         Engine              LangGraph             Engine
             │                    │                    │
             │              ┌─────┼─────┐              │
             │              ▼     ▼     ▼              │
             │          Diagnose Decide Plan           │
             │                    │                    │
             │                    ▼                    │
             │              Policy Engine              │
             │                    │                    │
             │                    ▼                    │
             │              Tool Executor              │
             │             /      |       \             │
             ▼            ▼       ▼        ▼             ▼
          PostgreSQL   Payment  Messaging Escalation  Metrics
                         │
                         ▼
                    Outcome Tracker
```

## 🤖 Agent Workflow

```text
START
  ↓
Detect Revenue Risk
  ↓
Collect Customer + Payment Context
  ↓
Diagnose Root Cause
  ↓
Estimate Recovery Probability
  ↓
Select Recovery Strategy
  ↓
Apply Merchant Policies
  ↓
Execute Approved Action
  ↓
Observe Outcome
  ↓
 ┌───────────────┬──────────────┐
 │               │              │
Success         Retry         Escalate
 │               │              │
 ▼               ▼              ▼
Recover        Next Action    Human Review
Revenue
```

## 🛡️ Guardrails

Financial agents must not have unrestricted authority.

RecoverAI applies deterministic policies before executing actions.

Examples:

```text
Maximum payment retries
Maximum customer contacts
Maximum discount
High-value transaction approval
Fraud-related restrictions
Human escalation thresholds
Stop-contact rules
```

Example:

```text
Agent Decision:
Offer ₹500 discount

Policy:
Maximum discount = ₹200

Result:
BLOCKED
```

Every decision is recorded in the audit trail.

## 📊 Recovery Metrics

The system measures business outcomes instead of only AI accuracy.

### Primary metrics

* Revenue at Risk
* Eligible Revenue
* Revenue Recovered
* Recovery Rate
* Recovery Probability
* Successful Interventions
* Failed Interventions
* Human Escalations

### Example

```text
Transactions              10,000
Revenue at Risk            ₹18.4L
Eligible Revenue           ₹13.2L
Interventions                4,182
Successful Recoveries        1,624
Revenue Recovered             ₹7.84L
Recovery Rate                   59.4%
```

## 🧪 Experimentation

RecoverAI compares intelligent recovery against a baseline strategy.

### Baseline

```text
Generic retry
```

### RecoverAI

```text
Context-aware recovery strategy
```

Metrics:

* Revenue recovered
* Recovery rate
* Intervention count
* Retry count
* Customer contact rate
* Escalation rate
* False intervention rate

## 🧩 Recovery Workflows

### 1. Payment Failure Recovery

```text
Payment Failure
      ↓
Failure Classification
      ↓
Customer Context
      ↓
Recovery Probability
      ↓
Intervention Selection
      ↓
Retry / Reminder / Payment Link
```

### 2. Checkout Abandonment Recovery

```text
Checkout Started
      ↓
Customer Leaves
      ↓
Abandonment Analysis
      ↓
Customer Context
      ↓
Recovery Strategy
      ↓
Reminder / Payment Link / Incentive
```

### 3. Overdue Receivables

```text
Invoice Overdue
      ↓
Customer Segmentation
      ↓
Payment History
      ↓
Promise-to-Pay Detection
      ↓
Follow-up Strategy
      ↓
Payment / Escalation
```

## 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Recharts

### Backend

* Node.js
* NestJS
* TypeScript
* REST APIs
* WebSockets

### AI / Agent

* Python
* FastAPI
* LangGraph
* LLM
* Pydantic

### Machine Learning

* Scikit-learn
* XGBoost
* Pandas
* NumPy

### Data

* PostgreSQL
* Redis

### Background Processing

* BullMQ
* Redis

### Payments

* Razorpay APIs / Sandbox
* Payment simulator for deterministic demonstrations

### Communication

* Email
* WhatsApp
* Optional voice integration

### Infrastructure

* Docker
* Docker Compose
* AWS
* Object Storage

### Observability

* OpenTelemetry
* Prometheus
* Grafana
* Structured Logging

## 📁 Repository Structure

```text
recoverai/
├── apps/
│   ├── web/
│   └── api/
├── services/
│   ├── agent/
│   ├── ml/
│   └── simulator/
├── packages/
│   ├── database/
│   ├── types/
│   ├── config/
│   └── logger/
├── infrastructure/
├── data/
├── docs/
├── scripts/
├── tests/
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔐 Security

* JWT authentication
* Role-based access control
* API validation
* Rate limiting
* Idempotent payment actions
* Secret management
* Audit logging
* Policy-based action authorization

## 🧾 Audit Trail

Every agent action records:

```text
Agent Run ID
Recovery Case ID
Decision
Reason
Policy Evaluation
Tool Called
Tool Result
Timestamp
Execution Status
```

This allows merchants to understand exactly what the agent did and why.

## 🚦 Example Agent Decision

```text
CASE #REC-10291

Revenue at Risk:
₹2,999

Root Cause:
Insufficient Funds

Customer:
High-value returning customer

Previous Success Rate:
91%

Recovery Probability:
87%

Recommended Intervention:
Payment Retry + Reminder

Policy Evaluation:
APPROVED

Execution:
Payment Retry → SUCCESS

Recovered Revenue:
₹2,999
```

## 🌐 Deployment

Development:

```bash
docker compose up
```

Services:

```text
Frontend
Backend
Agent Service
ML Service
PostgreSQL
Redis
Monitoring
```

Production deployment can use:

```text
AWS
Docker
Managed PostgreSQL
Managed Redis
Object Storage
```

## 🎥 Demo Flow

The final demonstration follows a complete revenue recovery loop.

```text
1. Merchant opens dashboard
2. Revenue-at-risk is detected
3. Recovery case appears
4. Agent analyzes customer/payment context
5. Agent explains root cause
6. Recovery strategy is selected
7. Policy engine validates action
8. Payment/communication tool executes
9. Payment outcome is observed
10. Revenue recovered is updated
11. Audit trail records the complete decision
```

## 🏆 Goal

Recover money, not just identify problems.

The success of RecoverAI is measured by:

> **How much revenue can the system recover safely and measurably?**
