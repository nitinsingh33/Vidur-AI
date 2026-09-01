# VidurAI — System Architecture

This document describes the system **as implemented**, not as originally envisioned. Every diagram, file path, and behavior below has been verified directly against the codebase. Where a capability is partially built (e.g. WhatsApp), that is stated explicitly rather than implied.

Razorpay Buildathon Track 03 — AI Revenue Recovery: *detect revenue at risk, determine the right intervention, execute a bounded recovery workflow, and demonstrate measurable money recovered.*

---

## 1. System at a glance

```text
┌──────────────────────┐        ┌──────────────────────┐
│   Frontend (Vercel)   │        │  FashionKart Storefront │  ← same frontend app,
│  Merchant Dashboard   │        │   (public, no login)    │    public routes
└───────────┬───────────┘        └───────────┬───────────┘
            │  HTTPS / JWT                    │  HTTPS (unauthenticated)
            ▼                                 ▼
┌────────────────────────────────────────────────────────────┐
│                NestJS Backend API (Render)                  │
│  Auth · Merchants · Payments · Orders · Subscriptions ·      │
│  Mandates · Invoices · Policies · RecoveryCases · Storefront │
│  · Razorpay (checkout + webhooks) · Audit · Scheduled sweeps │
└───────┬───────────────────────┬───────────────┬────────────┘
        │ Prisma (pg)           │ BullMQ         │ HTTP (agent-facing,
        ▼                       ▼                │ x-agent-token)
┌───────────────┐      ┌────────────────┐        ▼
│ PostgreSQL     │      │ Redis          │  ┌─────────────────────────┐
│ (Neon)         │      │ (sweep queues) │  │ Python Agent Service    │
└───────────────┘      └────────────────┘  │ (FastAPI, Render)        │
        ▲                                   │  /diagnose  (Gemini)     │
        │ HTTPS (server-to-server)          │  /predict-recovery (ML)  │
        └───────────────────────────────────│  /run-recovery (LangGraph)│
                                             │  /generate-voice-message │
                                             └─────────────────────────┘
                    ▲
                    │ REST + Webhooks (HMAC-signed)
                    ▼
            ┌───────────────────┐
            │ Razorpay Test Mode │
            │ Orders · Payment    │
            │ Links · Subscriptions│
            │ · Mandates/UPI Autopay│
            └───────────────────┘
```

Four independently deployable pieces:

| Piece | Path | Runtime | Hosted on |
|---|---|---|---|
| Frontend | `frontend/` | React 19 + Vite + TypeScript | Vercel |
| Backend API | `backend/` | NestJS 11 + Prisma 7 | Render (web service) |
| AI Agent service | `agent/` | FastAPI + LangGraph + Gemini | Render (separate web service) |
| ML training | `ml/` | scikit-learn (offline, produces a `.joblib` the agent service loads) | not a running service — build artifact only |

Postgres is a managed Neon database; Redis backs BullMQ's scheduled sweep jobs. Local development runs Postgres + Redis via `docker-compose.yml`.

---

## 2. Repository layout (actual)

```text
Vidur_AI/
├── frontend/          React 19 + Vite + TypeScript + Tailwind CSS 4
│   └── src/
│       ├── pages/               dashboard pages + public storefront pages (pages/store/*)
│       ├── components/recovery/ agent timeline, reasoning card, guardrails
│       └── api/                 typed fetch clients per backend module
├── backend/           NestJS 11 + Prisma 7 (adapter-pg, no Prisma default client cache)
│   ├── prisma/
│   │   ├── schema.prisma        single source of truth for every model/enum
│   │   ├── seed.ts              synthetic historical dataset (10k-scale demo analytics)
│   │   └── seed-fashionkart.ts  additive, idempotent FashionKart demo tenant
│   └── src/
│       ├── recovery/            strategy selection, execution, observation (the decision core)
│       ├── recovery-auto/       in-process automatic orchestrator (the "hero path")
│       ├── risk/                detection → RecoveryCase opening, per signal type
│       ├── policy/              bounded guardrail engine
│       ├── razorpay/            checkout, payment links, subscriptions, mandates, webhook handling
│       ├── storefront/          public, unauthenticated customer-facing API (FashionKart)
│       ├── recovery-lab/        real-data scenario launcher for demos
│       ├── checkout-sweep/ invoices/ promise-to-pay/  scheduled BullMQ detection sweeps
│       ├── mandates/            UPI Autopay-style mandate retry sequencing
│       ├── ml/                  proxy to the Python agent's /predict-recovery
│       └── audit/                immutable decision log
├── agent/             FastAPI service — the AI participant
│   └── app/
│       ├── graph/workflow.py    LangGraph StateGraph — the manual/batch decision graph
│       ├── llm/diagnosis.py     Gemini narration (best-effort, retried on 429)
│       ├── llm/voice_message.py Gemini TTS Hinglish voice-message channel
│       └── main.py              FastAPI routes: /diagnose /predict-recovery /run-recovery /generate-voice-message
├── ml/                offline training pipeline
│   ├── src/train.py             scikit-learn LogisticRegression + ColumnTransformer pipeline
│   └── models/                  recovery_probability_model.joblib (loaded by agent/)
└── docker-compose.yml           local Postgres + Redis
```

---

## 3. Data model

Every model lives in `backend/prisma/schema.prisma`. The important shape to understand: **one `RecoveryCase` can be opened from exactly one of five different signal types** — a `Payment`, an `Order` (checkout abandonment), an `Invoice` (overdue receivable), a `Subscription` (failed billing cycle), or a `Mandate` (paused/rejected UPI Autopay) — and every downstream step (strategy, policy, action, outcome) is written generically against whichever one is set.

```text
Merchant ──┬── MerchantUser (ADMIN/OPERATOR/FINANCE_MANAGER, JWT login)
           ├── Product          (FashionKart storefront catalogue)
           ├── Customer
           ├── Order ──────────── Payment ──── PaymentEvent
           ├── Subscription
           ├── Mandate
           ├── Invoice
           ├── Policy            (per merchant, per RecoveryActionType)
           └── RecoveryCase ──┬── RecoveryAction (one row per attempted intervention)
                               ├── RecoveryOutcome (terminal, webhook-confirmed only)
                               └── PromiseToPay (B2B "customer promised to pay by X")
RecoveryBatch                  groups cases detected together (Recovery Lab / batch runs)
AuditLog                       append-only: every policy check, execution, escalation
```

Key enums (`RecoveryActionType`, `RecoveryCaseStatus`, `PolicyAction`, …) are defined once in the schema and shared verbatim by TypeScript (generated Prisma client) and implicitly by the Python agent (which talks to the backend over HTTP, never touches the database directly).

---

## 4. The decision core — one set of rules, two callers

This is the architectural decision worth highlighting to a judge: **the actual "what should the agent do" logic exists in exactly one place** — `RecoveryService` (`backend/src/recovery/recovery.service.ts`) plus `PolicyService`. Two different callers drive that same logic, for two different purposes:

```text
                    ┌─────────────────────────────────────────┐
                    │   RecoveryService / PolicyService         │
                    │   (single source of truth, NestJS)        │
                    │                                            │
                    │  createStrategyForCase → checkForRecovery-│
                    │  Case → executeRecoveryAction → observe-  │
                    │  Recovery                                  │
                    └───────┬─────────────────────┬──────────────┘
                             │ in-process call       │ HTTP call
                             ▼                       ▼
        ┌───────────────────────────┐   ┌─────────────────────────────┐
        │ RecoveryAutoOrchestrator- │   │ LangGraph StateGraph          │
        │ Service                   │   │ (agent/app/graph/workflow.py) │
        │ — the AUTOMATIC hero path │   │ — the MANUAL/BATCH "Run Agent"│
        │ Fired by: webhooks,       │   │   path and the Recovery Lab    │
        │ BullMQ sweeps             │   │ Fired by: a human clicking     │
        │ Sub-second, no HTTP hop   │   │ "Run Agent", or a batch job    │
        └───────────────────────────┘   └─────────────────────────────┘
```

Both paths call the identical four backend methods in the identical order:

```text
createStrategyForCase → generateAiDiagnosis (best-effort) → checkForRecoveryCase (policy)
       → ALLOW → executeRecoveryAction → observeRecovery
       → REQUIRE_APPROVAL / BLOCK → escalateRecoveryCase
```

The only difference is transport: the automatic path calls these as plain in-process TypeScript method calls (so a real-time webhook can react in milliseconds), while the LangGraph agent calls the same operations as authenticated HTTP endpoints (`POST /recovery/cases/:id/strategy`, `/policies/check/:id/:type`, `/recovery/cases/:id/execute`, `/recovery/cases/:id/observe`, `/escalation/cases/:id`), guarded by a shared-secret `x-agent-token` header. **There is no second, divergent decision engine** — the LangGraph graph is a orchestration/retry wrapper around the same backend calls, not an independent brain.

### 4.1 The LangGraph state machine

```text
START → load_recovery_case → analyze_context → get_recovery_probability
      → select_intervention → diagnose_case → policy_check
                                                   │
                                    ┌──────────────┴──────────────┐
                                  ALLOW                    REQUIRE_APPROVAL / BLOCK
                                    │                              │
                                    ▼                              ▼
                                 execute → observe              escalate → END
                                              │
                          ┌───────────────────┼───────────────────┐
                        success            shouldRetry          exhausted
                          │                   │                    │
                          ▼                   ▼                    ▼
                        recover → END   select_intervention     escalate → END
                                        (loop back)
```
Source: `agent/app/graph/workflow.py`.

### 4.2 AI participation — real, but deliberately non-authoritative

Two independent AI/ML calls happen on every case, and **neither one is allowed to decide the outcome**:

1. **Recovery-probability model** — a real scikit-learn `LogisticRegression` pipeline (`ml/src/train.py`: `ColumnTransformer` + `OneHotEncoder` + `StandardScaler`), trained offline and served from the agent service's `/predict-recovery` endpoint (loaded from `ml/models/recovery_probability_model.joblib`). It's a genuinely trained classifier on real feature columns (amount, failure reason, payment method, customer history, retry count, …) — not a stub — but it is honestly a lightweight demo-scale model, not a production-scale one.
2. **Gemini narration** — `agent/app/llm/diagnosis.py` calls Gemini (`google-genai` SDK) to write a 2-3 sentence human-readable explanation of *why* the already-chosen intervention makes sense. It is called **after** the deterministic strategy table has already picked the intervention — it explains a decision, it never makes one.

Both calls are wrapped as best-effort: a timeout, quota error, or bad key degrades gracefully (the reasoning field stays `null`, the ML probability stays `null`) and the deterministic strategy/policy/execution path proceeds unaffected. This is enforced in code, not by convention — `RecoveryAutoOrchestratorService.generateAiDiagnosis()` swallows every exception internally and is never in the automatic path's own try/catch.

Reliability hardening (added after a real production incident — see §9): Gemini's `/diagnose` call now retries up to twice on a genuine `429` (rate-limit) response with exponential backoff + jitter, and every sweep that can open many cases at once throttles the resulting AI calls to 3 concurrent instead of firing all of them simultaneously.

---

## 5. Detection — six independent signal sources, one destination

Every detection path ends the same way: a `RecoveryCase` row is opened via `RiskService`, then handed to `RecoveryAutoOrchestratorService.runAutomaticRecovery()`.

| # | Signal | Trigger | Detector |
|---|---|---|---|
| 1 | Payment failure | Razorpay `payment.failed` webhook | `RazorpayWebhookService` → `RiskService.assessPayment` |
| 2 | Checkout abandonment | BullMQ sweep, every 5 min (configurable) | `CheckoutSweepService` → `RiskService.assessOrderAbandonment` |
| 3 | Overdue invoice / B2B receivable | BullMQ sweep, every 60 min | `InvoiceOverdueSweepService` → `RiskService.assessInvoiceOverdue` |
| 4 | Subscription payment failure | Razorpay `subscription.pending`/`subscription.charged` webhook | `RazorpayWebhookService` → `RiskService.assessSubscriptionFailure` |
| 5 | Mandate paused/rejected (UPI Autopay) | Razorpay `token.*` webhook | `RazorpayWebhookService` → `RiskService.assessMandateFailure` |
| 6 | Promise-to-Pay missed | BullMQ sweep, every 15 min, past the promised date | `PromiseToPaySweepService` (resumes the case's existing automatic pipeline) |

All three sweep services (checkout, invoice, promise-to-pay) share the same throttling pattern: they create every case eagerly, then hand the resulting case ids to a small bounded-concurrency runner (`backend/src/recovery-auto/concurrency.util.ts`, limit 3) so a 200-case sweep can't burst 200 simultaneous AI calls.

---

## 6. Execution — one real mechanism behind every "intervention"

`RecoveryService.executeRecoveryAction` (`backend/src/recovery/recovery.service.ts`) resolves every non-email, non-mandate `RecoveryActionType` — `SEND_PAYMENT_LINK`, `RETRY_PAYMENT`, `UPDATE_PAYMENT_METHOD`, `FOLLOW_UP_RECEIVABLE` — to the exact same real mechanism: **a genuine Razorpay Payment Link**, created via `RazorpayService.createPaymentLink()` (`POST /v1/payment_links/`), with Razorpay's own `notify.sms`/`notify.email` flags set from whatever contact details the customer actually has on file.

The one exception: a `RETRY_PAYMENT` whose failed payment came from a mandate-backed debit (`Order.mandateId` set) charges the existing UPI Autopay mandate directly and headlessly — no payment link, because the customer already delegated a standing authorization. That retry is throttled by `MandateRetrySequencerService`'s NPCI-style retry rules, not by the generic policy engine's contact caps.

Two additional real channels exist, gated by policy exactly like the payment link:
- **Email** (`SEND_EMAIL`) via Resend (`NotificationService`).
- **Hinglish voice message** (`SEND_VOICE_MESSAGE`) — a genuinely Gemini-written script *and* Gemini-synthesized audio (`agent/app/llm/voice_message.py`, `/generate-voice-message`), used as a channel-escalation step after repeated payment-link attempts and before escalating to a human. It has never placed a real phone call — it produces an audio artifact.

**WhatsApp is modeled but not wired to a live channel.** `RecoveryActionType.SEND_WHATSAPP` exists in the schema and has a default policy (`backend/src/policy/default-policies.ts`), but there is no Twilio/WhatsApp Business API integration anywhere in the codebase — this is an intentionally honest gap, not a hidden one.

---

## 7. Observation and closure — never self-declared

No AI call, no policy decision, and no execution result is ever allowed to mark a case `RECOVERED`. `RecoveryService.observeRecovery()` only finds a case recovered when the underlying `Payment.status` is genuinely `CAPTURED` (or `Invoice.status` is `PAID`) — and that field is only ever set by `RazorpayWebhookService` reacting to one of three real Razorpay webhook events:

```text
payment_link.paid   — primary path, matched by RecoveryAction.externalReferenceId (plink_...)
payment.captured    — independent confirmation if the customer pays outside the link
order.paid          — defensive fallback if the above are missed or arrive out of order
```

This is the core integrity guarantee of the whole system: **"recovered" is a webhook fact, never an agent opinion.**

---

## 8. FashionKart — the demo merchant, and why it's real evidence

`frontend/src/pages/store/*` and `backend/src/storefront/*` implement a fully public, unauthenticated storefront (`GET/POST /storefront/:slug/...`) that any judge can use as a real customer, with zero login:

```text
Judge opens /store/fashionkart → browses real Product rows → adds to cart
   → checks out → StorefrontService.createOrder resolves the merchant purely
     from the URL slug, computes totals from the database's own prices
     (never trusts a client-supplied amount) → opens a genuine Razorpay
     Test Mode order → judge fails or completes a real Test Mode payment
   → Razorpay fires a real webhook → the exact same detection → decision
     → execution → observation pipeline above runs, unmodified
```

`seed-fashionkart.ts` seeds this merchant additively and idempotently (upsert-by-slug, upsert-by-email — never deletes or wipes any other merchant's data) with 10 products and an admin login (`admin@fashionkart.vidur.ai`). FashionKart transacts through Vidur's own shared Razorpay sandbox credentials (`RazorpayService.resolveCredentials`), so a judge needs zero setup of their own.

This directly answers the "is this just a dashboard simulation?" question a buildathon judge will ask: the trigger for every demoed recovery is a real customer action against a real Razorpay Test Mode integration, not a button that writes a fabricated row into the database.

### Recovery Lab

`backend/src/recovery-lab/` (`POST /recovery-lab/...`) is a scenario launcher for the workflows that are awkward to trigger live in front of an audience (subscription failure, mandate pause, overdue invoice, promise-to-pay). Its own doc comment states the constraint precisely: *"not a fake-data generator... every method creates real underlying rows via the exact same services production traffic uses, then hands off to the exact same automatic pipeline."* It never creates a `RecoveryOutcome` directly — recovery still only happens through a real webhook.

---

## 9. Guardrails — bounded authority, by policy

`PolicyService.checkForRecoveryCase` evaluates every candidate action against a per-merchant `Policy` row before `executeRecoveryAction` is ever allowed to run. Defaults (`backend/src/policy/default-policies.ts`, seeded for every merchant at signup):

| Action | Bound |
|---|---|
| Retry payment | ≤ 3 attempts, ≥ 24h apart |
| Send payment link | ≤ 3 contacts |
| Send recovery email | ≤ 5 contacts |
| Send WhatsApp reminder | ≤ 3 contacts (channel not yet wired — see §6) |
| Request payment method update | ≤ 2 contacts |
| Follow up on receivable | ≤ 5 contacts |
| Hinglish voice message | ≤ 1 attempt (escalation step) |
| Escalate to human / Stop recovery | always allowed |

A `BLOCK` or `REQUIRE_APPROVAL` decision routes to `EscalationService` instead of execution — the case pauses for a human, it is never silently retried past its bound. Every policy check, execution, and escalation is written to `AuditLog` (`backend/src/audit/`): agent run, case id, decision, reason, tool called, result, timestamp.

---

## 10. Reliability hardening (production incident → fix)

A real production issue surfaced and was root-caused and fixed in this codebase (documented here because it's evidence of an actually-operated system, not a one-shot demo build):

- **Symptom:** the dashboard's execution timeline claimed *"Gemini reasoning ready"* even when Gemini had failed.
- **Root cause:** `agent/app/llm/diagnosis.py` made a single, un-retried Gemini call; three BullMQ sweep services fired every case's diagnosis call as unthrottled fire-and-forget (`void this.autoOrchestrator.runAutomaticRecovery(...)` in a loop), so a 200-case sweep burst ~200 simultaneous Gemini calls and exhausted its rate limit — while `frontend/src/components/recovery/AgentExecutionTimeline.tsx` hardcoded its status caption regardless of whether real reasoning existed.
- **Fix:** `runWithConcurrency()` bounds sweep-triggered AI calls to 3 concurrent; `generate_diagnosis()` retries a genuine `429` up to twice with exponential backoff + jitter (any other error still fails fast); the timeline caption now reads the pipeline's own truthful `detail` field instead of a hardcoded string.

This is a live example of the system's own audit/observability surface being used to diagnose and fix itself.

---

## 11. Security & multi-tenancy

- JWT-authenticated merchant dashboard (`AuthController`/`JwtAuthGuard`); every dashboard endpoint scopes queries by `request.user.merchantId` — one merchant's session cannot see another's cases, even by guessing an id (`RecoveryCasesController`, `RecoveryCasesService.findOne` returns 404, not 403, on a cross-tenant id — an "ownership-obscuring" convention used throughout).
- The public storefront API is intentionally unauthenticated but merchant-scoped by URL slug only — it never trusts a client-supplied amount, always recomputing totals from `Product.priceAmount`.
- The Python agent service authenticates to the backend's agent-facing endpoints with a shared-secret `x-agent-token` header (`AGENT_SERVICE_TOKEN`), not a merchant JWT — it has no login of its own.
- A merchant's own Razorpay API keys, when connected, are stored encrypted (`CredentialEncryptionModule`); a merchant with no keys connected (like the FashionKart demo tenant) transacts through Vidur's own shared sandbox credentials.
- Razorpay webhooks are HMAC-signature verified before any event is trusted (`RazorpayWebhookService`).

---

## 12. Deployment topology

```text
Vercel  ─────────────────  frontend/  (React SPA, client-side routed — vercel.json rewrites all paths to index.html)
Render  ─────────────────  backend/   (NestJS, Build: npm install && npx prisma generate && npx prisma migrate deploy && npm run build)
Render  ─────────────────  agent/     (FastAPI, separate web service — GEMINI_API_KEY / GEMINI_MODEL / BACKEND_URL / AGENT_SERVICE_TOKEN)
Neon    ─────────────────  managed Postgres (pooled connection for the app, migrations need a direct/unpooled connection — see §13 caveat)
Redis   ─────────────────  BullMQ job scheduler backing the three sweep services
```

Local development: `docker compose up` starts Postgres + Redis; each of `frontend/`, `backend/`, `agent/` runs with its own `npm run start:dev` / `npm run dev` / `uvicorn` process against `.env.example`-derived local config.

### 13. A known operational caveat (kept here for honesty, not swept under the rug)

Neon's pooled connection string runs through a transaction-mode PgBouncer, which does not reliably hold the session-scoped Postgres advisory lock `prisma migrate deploy` takes. In practice this has shown up as an intermittent `P1002` advisory-lock timeout on the very first deploy attempt after a cold Neon compute start; a plain redeploy retry has always cleared it (the compute is already warm on the second attempt). A more permanent fix — a dedicated `directUrl` for migrations — is a known, not-yet-made improvement, deliberately left out of this document's "what's built" claims.

---

## 14. What is real vs. what is intentionally synthetic

Stated plainly, because a buildathon judge will ask:

| Claim | Status |
|---|---|
| Storefront checkout → Razorpay order → webhook → recovery pipeline | **Real** — genuine Razorpay Test Mode API calls and HMAC-verified webhooks, for any judge acting as a customer |
| Payment link / email / voice-message execution | **Real** — genuine Razorpay Payment Links API, Resend email API, Gemini TTS audio |
| "Recovered" status | **Real** — only ever set from a verified webhook, never from an AI or policy decision |
| ML recovery-probability score | **Real, but small-scale** — a genuinely trained scikit-learn model, on a small seeded dataset sized for a demo, not production traffic |
| Gemini reasoning | **Real** — an actual Gemini API call per case, best-effort, narration-only |
| 10,000-row historical payment analytics | **Synthetic, and described as such** — `prisma/seed.ts` seeds a realistic historical dataset for the degradation/analytics views; it is not real merchant traffic, and the system is honest about that distinction rather than presenting it as live data |
| WhatsApp recovery channel | **Modeled, not wired** — a real policy and action type exist; no message is ever actually sent yet |
