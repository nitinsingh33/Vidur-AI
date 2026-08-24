Absolutely. For a recruiter, I would keep `docs/architecture.md` **short, visual, and implementation-focused**—not a giant technical document.

Based on what we actually built in Phases 1–11, use this:

````markdown
# RecoverAI — System Architecture

> Agentic revenue recovery orchestration system for detecting failed payments,
> deciding recovery actions, enforcing policies, and executing recovery workflows.

---

## 1. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │      React UI        │
                         │   Phase 12 Dashboard │
                         └──────────┬───────────┘
                                    │ REST
                                    ▼
┌───────────────────────────────────────────────────────────────┐
│                         NestJS Backend                        │
│                                                               │
│  Payments │ Recovery │ Risk │ Policy │ Analytics              │
│  Razorpay │ Notification │ Escalation │ Recovery Queue        │
└───────────┬───────────────────────┬───────────────────────────┘
            │                       │
            │                       ▼
            │                ┌───────────────┐
            │                │  PostgreSQL   │
            │                │  Prisma ORM   │
            │                └───────────────┘
            │
            ├──────────────► Razorpay Test API
            │
            ├──────────────► Resend
            │
            ▼
     ┌─────────────────┐
     │ Redis + BullMQ  │
     │ Recovery Queue  │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ Recovery Worker  │
     └────────┬────────┘
              │ HTTP
              ▼
┌───────────────────────────────────────────────────────────────┐
│                    Python Agent Service                       │
│                                                               │
│  FastAPI                                                      │
│    │                                                          │
│    ├── ML Recovery Probability                                │
│    │                                                          │
│    └── LangGraph Recovery Agent                               │
│             │                                                 │
│             ├── PaymentTool ───────► NestJS ──► Razorpay      │
│             ├── NotificationTool ──► NestJS ──► Resend        │
│             └── EscalationTool ────► NestJS business layer   │
└───────────────────────────────────────────────────────────────┘
````

---

## 2. Core Recovery Flow

```text
Payment Failure
      │
      ▼
NestJS Recovery Case
      │
      ▼
Risk Assessment
      │
      ▼
LangGraph Agent
      │
      ├── Load Context
      │
      ├── Analyze Failure
      │
      ├── Predict Recovery Probability
      │
      ├── Select Intervention
      │
      ▼
Policy Engine
      │
      ├────────────── BLOCK ──────────────► Escalation
      │
      ▼
     ALLOW
      │
      ▼
Tool Execution
      │
      ├── PaymentTool
      ├── NotificationTool
      └── EscalationTool
      │
      ▼
Observe Outcome
      │
      ├── Recovered
      └── Escalated
```

---

## 3. Agent Architecture

The recovery agent is implemented as a LangGraph state machine.

```text
START
  │
  ▼
load_recovery_case
  │
  ▼
analyze_context
  │
  ▼
get_recovery_probability
  │
  ▼
select_intervention
  │
  ▼
policy_check
  │
  ├── BLOCK ─────► escalation
  │
  ▼
execute
  │
  ▼
observe
  │
  ├── success ───► recover
  │
  └── failure ───► escalate
```

The agent maintains state including:

* Recovery case
* Root cause
* Payment amount
* Payment method
* Failure reason
* Retry count
* Recovery probability
* Candidate intervention
* Policy decision
* Execution result
* Recovery outcome

---

## 4. Safety / Policy Layer

The agent does not execute recovery actions blindly.

```text
Agent Decision
      │
      ▼
Policy Engine
      │
      ├── Amount Limit
      ├── Retry Limit
      └── Enabled Policy
      │
      ▼
ALLOW / BLOCK
```

Example:

```text
retry_count = 3
maxRetries  = 2

        ↓

BLOCK

        ↓

Escalate
```

Policy decisions are persisted against recovery actions for auditability.

---

## 5. Tool Execution Architecture

The agent does not directly own external business integrations.

```text
LangGraph Agent
      │
      ▼
Agent Tool
      │
      ▼
NestJS Business Layer
      │
      ├── Razorpay Test API
      ├── Resend
      └── Escalation / Database
```

This keeps external integrations behind the NestJS business/security boundary.

### Implemented Tools

| Tool             | Purpose                      | Integration       |
| ---------------- | ---------------------------- | ----------------- |
| PaymentTool      | Payment/recovery interaction | Razorpay Test API |
| NotificationTool | Recovery notification        | Resend            |
| EscalationTool   | Human escalation             | NestJS            |

---

## 6. ML Layer

FastAPI hosts the recovery prediction model.

```text
Recovery Case
     │
     ▼
NestJS ML Features
     │
     ▼
FastAPI
     │
     ▼
Recovery Probability Model
     │
     ▼
Recovery Probability
```

The LangGraph agent uses this probability as part of recovery decision-making.

---

## 7. Asynchronous Processing

Recovery jobs are processed asynchronously using Redis and BullMQ.

```text
NestJS
   │
   ▼
BullMQ Recovery Queue
   │
   ▼
Redis
   │
   ▼
Recovery Worker
   │
   ▼
FastAPI / LangGraph
```

This separates API requests from potentially long-running recovery workflows and provides a foundation for processing recovery cases asynchronously.

---

## 8. Data Layer

```text
NestJS
   │
   ▼
Prisma ORM
   │
   ▼
PostgreSQL
```

Core domain entities include:

* Merchants
* Customers
* Orders
* Payments
* Payment Events
* Subscriptions
* Invoices
* Recovery Cases
* Recovery Actions
* Recovery Outcomes
* Policies
* Audit Logs

---

## 9. Technology Stack

| Layer               | Technology          |
| ------------------- | ------------------- |
| Frontend            | React               |
| Backend             | NestJS + TypeScript |
| Agent               | Python + LangGraph  |
| ML API              | FastAPI             |
| ML                  | scikit-learn        |
| Database            | PostgreSQL          |
| ORM                 | Prisma              |
| Queue               | BullMQ              |
| Queue State         | Redis               |
| Payment Integration | Razorpay Test API   |
| Notifications       | Resend              |
| Containerization    | Docker              |

---

## 10. Design Principles

### Agentic Decision Making

The recovery workflow is modeled as a stateful LangGraph agent rather than a single hard-coded function.

### Policy-Governed Actions

Agent decisions pass through a policy layer before execution.

### Business Logic Boundary

External integrations are accessed through NestJS rather than allowing the agent to directly own business infrastructure.

### Asynchronous Recovery

BullMQ + Redis decouple recovery processing from synchronous API requests.

### Auditability

Recovery actions, policy decisions, outcomes, and audit information are represented in the backend data model.

### Safe Execution

Recovery actions are observable and can terminate in either successful recovery or escalation.

---

## 11. Current Implementation Status

### Backend / Agent

* [x] PostgreSQL data layer
* [x] NestJS backend
* [x] Recovery case management
* [x] Risk assessment
* [x] ML recovery probability
* [x] LangGraph recovery workflow
* [x] Policy engine
* [x] PaymentTool
* [x] Razorpay Test API integration
* [x] NotificationTool
* [x] Resend integration
* [x] EscalationTool
* [x] Redis
* [x] BullMQ recovery queue
* [x] Recovery worker
* [x] Worker → FastAPI → LangGraph integration

### Next

* [ ] React dashboard
* [ ] Recovery case visualization
* [ ] Agent decision timeline
* [ ] Revenue recovery analytics
* [ ] Production deployment

````

### Where I recommend putting it

Create:

```text
RecoverAI-Agentic_Revenue_Recovery_Orchestrator/
└── docs/
    └── architecture.md
````

This is intentionally **not a full documentation manual**. A recruiter should be able to open `architecture.md` and understand within ~2 minutes:

**what RecoverAI does → how the agent works → where ML fits → how tools execute → how policy protects execution → how Redis/BullMQ scales it → what technologies you used.**

One thing I would **not** put in this recruiter-facing architecture file is the temporary test endpoint or hardcoded Razorpay test order. Those were verification mechanisms, not part of the intended production architecture.
