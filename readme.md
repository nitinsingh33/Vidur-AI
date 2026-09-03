# VidurAI — Agentic Revenue Recovery Orchestrator

> An AI-powered revenue recovery agent that detects revenue at risk, diagnoses the root cause, selects the right intervention, executes a bounded recovery workflow, and only ever calls money "recovered" once a real Razorpay webhook confirms it.

**Live demo:** [www.vidurai.co.in](https://www.vidurai.co.in) · **API:** [vidurai-backend.onrender.com](https://vidurai-backend.onrender.com/)
**Full technical architecture:** see [`architecture.md`](./architecture.md)

---

## 🎯 Razorpay Buildathon Track

**Track 03 — AI Revenue Recovery**

Build an agent that detects revenue at risk, determines the appropriate intervention, and executes a bounded recovery workflow while demonstrating measurable money recovered.

## 🚀 The problem

Revenue doesn't disappear through one kind of failure. Businesses lose money through failed payments, checkout abandonment, failed subscription renewals, overdue B2B invoices, and paused/rejected UPI Autopay mandates — and most systems stop at *detecting* these events, leaving recovery to a human or a static retry cron.

```text
Detect → Diagnose → Decide → Validate → Execute → Observe → Recover
```

VidurAI closes that loop for six of these failure modes, end to end, without a human clicking "run recovery."

## ✅ What's real vs. what's synthetic (read this before the demo)

We'd rather you hear this from us than discover it mid-demo:

| | |
|---|---|
| **Real** | Every checkout on the FashionKart storefront hits a genuine Razorpay Test Mode order. Every "recovered" status is set only after a real, HMAC-verified Razorpay webhook (`payment_link.paid` / `payment.captured` / `order.paid`). Every recovery action that reaches a customer is a genuine Razorpay Payment Link, a real Resend email, or a real Gemini-written-and-synthesized Hinglish voice message. The ML recovery-probability score is a genuinely trained scikit-learn model. |
| **Synthetic, and labeled as such** | The 10,000-row historical payment dataset used for degradation/analytics charts is a seeded demo dataset, not live merchant traffic — we say so on the page, not just here. |
| **Modeled, not yet wired** | `SEND_WHATSAPP` exists as a policy-governed action type in the schema; no message actually goes out yet. |

Full detail, file-by-file, in [`architecture.md §14`](./architecture.md#14-what-is-real-vs-what-is-intentionally-synthetic).

## 🛍️ The demo story: FashionKart

FashionKart is a fully working, zero-login demo storefront (`/store/fashionkart`) — anyone can act as a real customer:

```text
Judge opens the store → adds a product to cart → checks out
     → genuine Razorpay Test Mode payment (make it fail on purpose)
     → Razorpay sends a real payment.failed webhook — nobody clicked a button
     → the backend opens a RecoveryCase automatically
     → the agent diagnoses it, checks policy, and executes — automatically
     → a real Razorpay Payment Link is generated and would be sent to the customer
     → the judge opens that link and completes a real Test Mode payment
     → Razorpay sends a real payment_link.paid webhook
     → the case is marked RECOVERED — because Razorpay said so, not because the AI did
```

No "Simulate Failure" button in this path. The [Recovery Lab](#-recovery-lab) exists separately for workflows that are awkward to trigger live on stage (subscriptions, mandates, overdue invoices) — it still creates real underlying rows and runs the real, unmodified pipeline; it just skips waiting out a real-time grace period.

## 🧠 Architecture — the short version

```text
┌──────────────┐        ┌────────────────────┐        ┌──────────────────────┐
│  Frontend     │◄──────►│  NestJS Backend API │◄──────►│  Python Agent Service │
│  (Vercel)     │  HTTPS │  (Render)            │  HTTP  │  FastAPI + LangGraph  │
│  Dashboard +  │        │  Prisma → Postgres   │ agent- │  Gemini + scikit-learn│
│  FashionKart  │        │  BullMQ → Redis      │ token  │  (Render)             │
└──────────────┘        └──────────┬───────────┘        └──────────────────────┘
                                     │ HMAC-verified webhooks + REST
                                     ▼
                          ┌────────────────────┐
                          │  Razorpay Test Mode │
                          │  Orders · Links ·   │
                          │  Subscriptions ·    │
                          │  Mandates           │
                          └────────────────────┘
```

The one thing worth understanding architecturally: **there is a single decision engine, called two different ways.** `RecoveryService`/`PolicyService` in the NestJS backend own every rule for "what should happen next." A real-time webhook or scheduled sweep calls those methods **in-process** for sub-second automatic recovery (the hero path — no "Run Agent" click). A LangGraph state machine in the Python agent service calls the **exact same methods over HTTP** for the manual "Run Agent" button and the Recovery Lab. Neither path has its own separate brain. Full diagrams and the actual LangGraph node graph: [`architecture.md §4`](./architecture.md#4-the-decision-core--one-set-of-rules-two-callers).

## 🤖 Where AI actually participates — and where it deliberately doesn't

```text
Failure detected
      ↓
Deterministic strategy table picks a candidate intervention   ← no AI here
      ↓
Gemini narrates *why* it's appropriate (best-effort)           ← AI, non-authoritative
ML model estimates recovery probability (best-effort)          ← AI, non-authoritative
      ↓
Policy engine checks bounds (ALLOW / BLOCK / REQUIRE_APPROVAL) ← no AI here
      ↓
ALLOW → execute a real Razorpay Payment Link / email / voice message
      ↓
Wait for a real Razorpay webhook                                ← no AI here
      ↓
RECOVERED (only ever set from that webhook)
```

If Gemini is rate-limited or the ML service is down, the case still gets a recovery attempt — the narration and probability score are additive context, never a gate. This is enforced in code (`RecoveryAutoOrchestratorService.generateAiDiagnosis` swallows its own failures), not just a design intent.

## 🧩 Six recovery workflows, one pipeline

| Workflow | Trigger | Status |
|---|---|---|
| Payment failure | Razorpay `payment.failed` webhook | Fully automatic |
| Checkout abandonment | BullMQ sweep (5 min) | Fully automatic |
| Overdue invoice / B2B receivables | BullMQ sweep (60 min) | Fully automatic |
| Subscription payment failure | Razorpay `subscription.*` webhook | Fully automatic |
| Mandate paused/rejected (UPI Autopay) | Razorpay `token.*` webhook | Fully automatic |
| Promise-to-Pay missed | BullMQ sweep (15 min), past promised date | Resumes automatic pipeline |

## 🛡️ Guardrails

The agent never has unbounded authority — every action is checked against a per-merchant `Policy` row before it runs.

```text
Retry payment              ≤ 3 attempts, ≥ 24h apart
Send payment link           ≤ 3 contacts
Send recovery email         ≤ 5 contacts
Request payment method      ≤ 2 contacts
Follow up on receivable     ≤ 5 contacts
Hinglish voice message      ≤ 1 attempt (escalation step)
```

A `BLOCK` or `REQUIRE_APPROVAL` decision escalates to a human instead of executing — it never silently retries past its bound. Every check, execution, and escalation is written to an append-only audit log: agent run id, case id, decision, reason, tool called, result, timestamp.

## 📊 Recovery metrics

The dashboard measures business outcomes, not just model accuracy:

* Revenue at Risk / Eligible Revenue / Revenue Recovered
* Recovery Rate, Recovery Probability
* Successful vs. Failed Interventions, Human Escalations

## 🧪 Recovery Lab

A scenario launcher (`/recovery-lab`) for the workflows that are awkward to demo live: it creates a real Payment/Order/Subscription/Invoice/Mandate row via the exact same services production traffic uses, then hands off to the exact same automatic pipeline a genuine webhook would trigger. It never fabricates a `RecoveryOutcome` — recovery still only happens through a real webhook or a merchant's own "Mark Paid" attestation for B2B.

## 🛠️ Technology stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7 |
| Backend | NestJS 11, TypeScript, Prisma 7 (`@prisma/adapter-pg`), BullMQ 6 + Redis (ioredis) |
| AI Agent | Python, FastAPI, LangGraph, `google-genai` (Gemini) |
| Machine Learning | scikit-learn (LogisticRegression + ColumnTransformer pipeline), pandas, joblib |
| Database | PostgreSQL (Neon in production, Docker locally) |
| Payments | Razorpay APIs — Orders, Payment Links, Subscriptions, Mandates/UPI Autopay, Webhooks |
| Communication | Resend (email), Gemini TTS (Hinglish voice messages) |
| Infrastructure | Vercel (frontend), Render (backend + agent service), Docker Compose (local Postgres + Redis) |

## 📁 Repository structure (actual)

```text
Vidur_AI/
├── frontend/           React app — merchant dashboard + public FashionKart storefront
├── backend/            NestJS API — recovery engine, policy engine, Razorpay integration, sweeps
│   └── prisma/         schema.prisma (single source of truth) + seed scripts
├── agent/              FastAPI service — LangGraph decision graph, Gemini narration + TTS, ML proxy
├── ml/                 offline training pipeline that produces the .joblib the agent service loads
├── docker-compose.yml  local Postgres + Redis
└── architecture.md     full technical architecture (read this for depth)
```

## 🔐 Security

* JWT-authenticated dashboard, every query scoped to `request.user.merchantId`
* Ownership-obscuring 404s — a cross-tenant case id returns "not found," never "forbidden"
* Public storefront never trusts a client-supplied amount — totals are always recomputed server-side from `Product` prices
* Razorpay webhooks are HMAC-signature verified before any event is trusted
* Merchant-connected Razorpay API keys are stored encrypted; the FashionKart demo tenant transacts through Vidur's own shared sandbox credentials so a judge needs zero setup

## ⚙️ Running it locally

```bash
# 1. Postgres + Redis
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # fill in RAZORPAY_*, JWT_SECRET, AGENT_SERVICE_TOKEN
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed                # loads the checked-in synthetic dataset (backend/data/synthetic/*.json)
                             # regenerate it yourself via `python backend/scripts/generate-data.py`
npm run seed:fashionkart    # additive, idempotent — FashionKart demo tenant + products
npm run start:dev           # http://localhost:3000

# 3. AI Agent service
cd agent
cp .env.example .env        # fill in GEMINI_API_KEY, AGENT_SERVICE_TOKEN (must match backend's)
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# 4. Frontend
cd frontend
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:3000
npm install
npm run dev                 # http://localhost:5173
```

Then open `http://localhost:5173/store/fashionkart` and check out as a customer — that's the real hero flow.

## 🎥 Suggested demo flow

```text
1. "Imagine FashionKart processes thousands of payments a day."
2. Open the live storefront, add a product, check out — fail the test payment on purpose.
3. "I didn't click anything on the dashboard." Show the webhook/audit log landing in real time.
4. Show the RecoveryCase: root cause, AI diagnosis, recovery probability, policy decision.
5. Show the real Razorpay Payment Link the agent generated.
6. Open that link, complete a real test payment.
7. "We only mark this recovered because Razorpay just told us so." Show the RECOVERED case + amount.
8. Briefly show the same architecture handling subscription/invoice/mandate cases via Recovery Lab.
```

## 📜 License

Proprietary — all rights reserved by Vidur AI. See [`LICENSE`](./LICENSE). This project may not be copied, modified, or redistributed without written permission.

## 🏆 Goal

Recover money, not just identify problems.

> **How much revenue can the system recover safely, automatically, and measurably?**
