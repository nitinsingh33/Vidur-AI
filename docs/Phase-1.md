# PHASE 0 — Understand RecoverAI completely

Before creating a database, we need to freeze the **business model**.

Our Track 03 problem is:

> **Detect revenue at risk → determine the right intervention → execute a bounded recovery workflow → measure the money recovered.**



---

## 0.1 What is "Revenue"?

For RecoverAI, **revenue** means money associated with a merchant's successful/completed commercial transactions.

Our main objects are:

```text
Order
  ↓
Payment
  ↓
Successful payment
  ↓
Revenue realized
```

Example:

```text
Order amount = ₹2,999
Payment = successful
Revenue realized = ₹2,999
```

If payment fails:

```text
Order amount = ₹2,999
Payment = failed
Revenue realized = ₹0
Potential revenue at risk = ₹2,999
```


---

# 0.2 What is Revenue At Risk?

Revenue at risk means:

> **Money that could reasonably have been collected but currently has a failure/blocker preventing collection.**

Example:

```text
Payment
₹5,000

Status:
FAILED

Customer:
Existing customer

Failure:
Insufficient funds

Retry count:
0
```

This is potentially recoverable.

Therefore:

```text
Revenue at Risk = ₹5,000
```

But:

```text
Payment
₹5,000

Fraud suspected
Customer blocked
Recovery prohibited
```

This should **not** be treated as an automatically recoverable ₹5,000.

---

# 0.3 What is a Recovery Case?

A **RecoveryCase** is the central object of our system.

Think:

> "There is a specific amount of money that might be recovered, and RecoverAI is now responsible for deciding what to do about it."

Example:

```text
RecoveryCase #RC001

Customer:
Rahul

Payment:
PAY123

Amount:
₹2,999

Reason:
Insufficient funds

Revenue at risk:
₹2,999

Status:
OPEN
```

One recovery case can then have multiple actions:

```text
RecoveryCase
      │
      ├── Retry payment
      ├── Send reminder
      └── Retry payment again
```

---

# 0.4 What is an Intervention?

An intervention is an **action intended to recover the money**.

Examples:

```text
RETRY_PAYMENT
SEND_PAYMENT_LINK
SEND_EMAIL
SEND_WHATSAPP
UPDATE_PAYMENT_METHOD
FOLLOW_UP_RECEIVABLE
ESCALATE_HUMAN
STOP_RECOVERY
```

The agent eventually chooses one.

---

# 0.5 What is a Recovery Action?

A recovery action is the **actual execution attempt**.

Example:

```text
Recovery Case RC001

Action #1
Type:
RETRY_PAYMENT

Result:
FAILED
```

Then:

```text
Action #2
Type:
SEND_PAYMENT_LINK

Result:
SUCCESS
```

Then payment succeeds.

So:

```text
Recovery Case
      │
      ├── Action 1
      ├── Action 2
      └── Action 3
```

---

# 0.6 What is Successful Recovery?

A recovery is successful when the system can associate a previously at-risk amount with a **successful collection/payment outcome**.

Example:

```text
₹2,999 at risk
       ↓
Retry
       ↓
Payment successful
       ↓
₹2,999 recovered
```

Therefore:

```text
recovered_amount = ₹2,999
```

This is the number the final dashboard will care about.

---

# 0.7 When should the agent stop?

This is critical because the screenshot specifically mentions **stopping rules**.

The agent should stop when:

### Case 1 — Payment recovered

```text
Payment successful
       ↓
STOP
```

### Case 2 — Maximum retries reached

```text
retry_count = 2
max_retry = 2
       ↓
STOP
```

### Case 3 — Maximum contact attempts reached

```text
contacts = 3
max_contacts = 3
       ↓
STOP
```

### Case 4 — Recovery prohibited

```text
Fraud / blocked / policy restriction
       ↓
STOP
```

### Case 5 — Human intervention required

```text
High-value case
       ↓
Human approval
       ↓
STOP AUTOMATION
```

This will eventually become our **Policy Engine**.

---

# 0.8 When should a human intervene?

Examples:

```text
Very high transaction amount
        ↓
Human approval
```

or:

```text
Agent confidence too low
        ↓
Human review
```

or:

```text
Repeated recovery failure
        ↓
Human escalation
```

or:

```text
Policy violation
        ↓
Human escalation
```

So our system isn't:

> "AI controls money."

It's:

> **AI recommends/reasons within predefined business boundaries.**

---

# 0.9 The complete business workflow

This is our **Phase-0 master workflow**.

```text
                    PAYMENT / BUSINESS EVENT
                              │
                              ▼
                    Is revenue at risk?
                         /          \
                       NO            YES
                       │              │
                      STOP            ▼
                              Create Recovery Case
                                      │
                                      ▼
                              Gather Context
                                      │
                                      ▼
                              Diagnose Problem
                                      │
                                      ▼
                         Determine Recovery Eligibility
                                      │
                              ┌───────┴────────┐
                              │                │
                           Eligible         Ineligible
                              │                │
                              ▼                ▼
                       Select Action          STOP
                              │
                              ▼
                        Policy Check
                              │
                    ┌─────────┼──────────┐
                    │         │          │
                  ALLOW    APPROVAL    BLOCK
                    │         │          │
                    ▼         ▼          ▼
                Execute     Human       STOP
                    │       Review
                    ▼
                 Observe
                    │
          ┌─────────┼──────────┐
          │         │          │
       SUCCESS    RETRY     ESCALATE
          │         │          │
          ▼         │          ▼
       RECOVER      │        HUMAN
       REVENUE      │
                    ▼
              Next Action
```

### **Phase 0 is finished.**

Our business vocabulary is now fixed.

---

# PHASE 1 — Database

Now we turn that business model into PostgreSQL.

## First: where do we create it?


For Phase 1, we only need:

```text
recoverai/
│
├── .gitignore
├── .env.example
├── README.md
│
└── backend/
    ├── src/
    ├── prisma/
    │   └── schema.prisma
    ├── prisma.config.ts
    ├── .env
    ├── package.json
    └── ...
```


# 1.1 PostgreSQL vs Prisma

Don't confuse these.

### PostgreSQL

The actual database.

```text
PostgreSQL
    ↓
stores tables
stores rows
stores relationships
```

### Prisma

Our TypeScript ORM.

```text
NestJS
   ↓
Prisma
   ↓
PostgreSQL
```


---

# 1.2 Which PostgreSQL should we use?

For development, I recommend:

### **Local PostgreSQL using Docker**

Why?

* Free
* No cloud dependency
* Easy reset
* Reproducible
* Later Docker already becomes part of our project
* We don't waste time configuring cloud DB today

We will eventually deploy a managed PostgreSQL database, but **not now**.

---

# 1.3 First create the project

Open VS Code.

Create:

```text
recoverai
```

Open that folder in VS Code.

Then terminal:

```bash
mkdir backend
cd backend
```

Now create NestJS:

```bash
npm install -g @nestjs/cli
nest new .
```

Choose:

```text
npm
```

We now have the backend application.

We are **not building backend APIs yet**.

We're only creating the place where Prisma will live.

---

# 1.4 Initialize Git immediately

Go back to root:

```bash
cd ..
git init
```

Create `.gitignore`.

It should include at minimum:

```text
node_modules/
.env
.env.*
!.env.example
dist/
coverage/
generated/
.DS_Store
```

**Important:** never commit your real `.env`.

Prisma's current initialization also creates a `.gitignore` with entries for `node_modules`, `.env`, and generated Prisma client output. ([Prisma][3])

---

# 1.5 Create `.env.example`

At:

```text
recoverai/backend/.env.example
```

put:

```text
DATABASE_URL="postgresql://recoverai:recoverai@localhost:5432/recoverai?schema=public"
```

And later your actual:

```text
backend/.env
```

will contain the same development connection.

But `.env` stays uncommitted.

---

# 1.6 Start PostgreSQL

At project root create:

```text
docker-compose.yml
```

For now, only PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:17
    container_name: recoverai-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: recoverai
      POSTGRES_PASSWORD: recoverai
      POSTGRES_DB: recoverai
    ports:
      - "5432:5432"
    volumes:
      - recoverai_postgres_data:/var/lib/postgresql/data

volumes:
  recoverai_postgres_data:
```

Then:

```bash
docker compose up -d
```

Check:

```bash
docker ps
```

You should see:

```text
recoverai-postgres
```

### We are deliberately NOT adding Redis yet.

That comes later.

---

# 1.7 Install Prisma

Go into backend:

```bash
cd backend
```

Install Prisma:

```bash
npm install prisma --save-dev
npm install @prisma/client @prisma/adapter-pg pg
```


---

# 1.8 Initialize Prisma

Run:

```bash
npx prisma init --datasource-provider postgresql --output ../src/generated/prisma
```

Current Prisma initialization creates the Prisma schema, configuration file and environment setup. ([Prisma][3])

You should now have:

```text
backend/
│
├── prisma/
│   └── schema.prisma
│
├── prisma.config.ts
│
├── .env
│
└── ...
```

---

# 1.9 Configure Prisma

Your `backend/.env`:

```text
DATABASE_URL="postgresql://recoverai:recoverai@localhost:5432/recoverai?schema=public"
```

And `prisma.config.ts` should point Prisma Migrate to this database URL. Current Prisma 7 configuration uses `prisma.config.ts` for the datasource URL. ([Prisma][1])

---

# 1.10 Now the important part — database design

We have **12 core entities**.

But I want to make one architectural improvement to our previous list.

We need one additional entity:

### `MerchantUser`

Why?

Because eventually:

```text
Merchant
   ↓
Merchant Users
   ↓
Dashboard
```

A merchant account can have multiple people using RecoverAI.

But we don't need authentication implementation today.

We'll simply model the relationship now.

So Phase-1 core models:

```text
Merchant
MerchantUser

Customer
Order
Payment
Subscription
Invoice
PaymentEvent

RecoveryCase
RecoveryAction
RecoveryOutcome

Policy
AuditLog
```

That's **13 models**.

---

# 1.11 Relationship design

This is the most important part.

## Merchant

```text
Merchant
 │
 ├── MerchantUsers
 ├── Customers
 ├── Orders
 ├── Payments
 ├── Subscriptions
 ├── Invoices
 ├── RecoveryCases
 └── Policies
```

---

## Customer

```text
Customer
 │
 ├── Orders
 ├── Payments
 ├── Subscriptions
 └── RecoveryCases
```

---

## Order

```text
Order
 │
 └── Payments
```

One order can potentially have multiple payment attempts.

That's important.

---

## Payment

```text
Payment
 │
 ├── PaymentEvents
 │
 └── RecoveryCases
```

A payment can fail, retry, fail again, succeed, etc.

---

## RecoveryCase

This is the center of RecoverAI:

```text
RecoveryCase
 │
 ├── Payment
 ├── Customer
 ├── RecoveryActions
 ├── RecoveryOutcome
 ├── AgentRuns       ← later
 └── AuditLogs
```

We'll add `AgentRun` in the agent phase because it represents an execution of the AI agent.

---

# 1.12 Database diagram

Our Phase-1 conceptual ER diagram:

```text
                         ┌─────────────┐
                         │   MERCHANT  │
                         └──────┬──────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        MerchantUser        Customer          Policy
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
                  Order      Payment    Subscription
                    │           │
                    │           ▼
                    │     PaymentEvent
                    │
                    ▼
                 Payment
                    │
                    ▼
             RecoveryCase
                    │
             ┌──────┼──────────┐
             ▼      ▼          ▼
       RecoveryAction  RecoveryOutcome
                    │
                    ▼
                AuditLog
```

---

# 1.13 Important data design decisions

### Money

Do **not** use floating point for money.

Bad:

```text
Float
```

Better:

```text
Decimal
```

We'll store:

```text
2999.00
```

rather than allowing floating-point precision problems.

---

### IDs

We'll use UUIDs rather than simple integer IDs.

Example:

```text
merchant_id
cus_8f2...
pay_7a1...
rec_91d...
```

This also looks much more realistic for a payment platform.

---

### Timestamps

Every important entity gets:

```text
createdAt
updatedAt
```

Events/actions also need their own execution timestamps.

---

# 1.14 Our Prisma schema

Now create:

```text
backend/prisma/schema.prisma
```

And put the following **initial Phase-1 schema** there:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

enum MerchantUserRole {
  ADMIN
  OPERATOR
  FINANCE_MANAGER
}

enum OrderStatus {
  CREATED
  PAID
  FAILED
  CANCELLED
}

enum PaymentStatus {
  CREATED
  PENDING
  AUTHORIZED
  CAPTURED
  FAILED
  REFUNDED
}

enum PaymentMethod {
  CARD
  UPI
  NETBANKING
  WALLET
  EMI
  OTHER
}

enum PaymentEventType {
  CREATED
  AUTHORIZED
  CAPTURED
  FAILED
  RETRY_STARTED
  RETRY_FAILED
  RETRY_SUCCEEDED
  REFUNDED
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
  EXPIRED
  PAYMENT_FAILED
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  OVERDUE
  CANCELLED
}

enum RecoveryCaseStatus {
  OPEN
  ELIGIBLE
  IN_PROGRESS
  RECOVERED
  EXHAUSTED
  ESCALATED
  STOPPED
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum RecoveryActionType {
  RETRY_PAYMENT
  SEND_PAYMENT_LINK
  SEND_EMAIL
  SEND_WHATSAPP
  UPDATE_PAYMENT_METHOD
  FOLLOW_UP_RECEIVABLE
  ESCALATE_HUMAN
  STOP_RECOVERY
}

enum RecoveryActionStatus {
  PENDING
  APPROVED
  BLOCKED
  EXECUTING
  SUCCESS
  FAILED
}

enum PolicyAction {
  ALLOW
  BLOCK
  REQUIRE_APPROVAL
}

model Merchant {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  currency  String   @default("INR")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users         MerchantUser[]
  customers     Customer[]
  orders        Order[]
  payments      Payment[]
  subscriptions Subscription[]
  invoices      Invoice[]
  recoveryCases RecoveryCase[]
  policies      Policy[]
  auditLogs     AuditLog[]
}

model MerchantUser {
  id         String           @id @default(uuid())
  merchantId String
  name       String
  email      String
  role       MerchantUserRole
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)

  @@unique([merchantId, email])
  @@index([merchantId])
}

model Customer {
  id         String   @id @default(uuid())
  merchantId String
  externalId String?
  name       String
  email      String?
  phone      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  merchant      Merchant       @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  orders        Order[]
  payments      Payment[]
  subscriptions Subscription[]
  recoveryCases RecoveryCase[]

  @@unique([merchantId, externalId])
  @@index([merchantId])
  @@index([email])
}

model Order {
  id         String      @id @default(uuid())
  merchantId String
  customerId String?
  amount     Decimal     @db.Decimal(18, 2)
  currency   String      @default("INR")
  status     OrderStatus @default(CREATED)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  merchant Merchant  @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  payments Payment[]

  @@index([merchantId])
  @@index([customerId])
  @@index([status])
}

model Payment {
  id            String        @id @default(uuid())
  merchantId    String
  customerId    String?
  orderId       String?
  amount        Decimal       @db.Decimal(18, 2)
  currency      String        @default("INR")
  method        PaymentMethod
  status        PaymentStatus @default(CREATED)
  failureReason String?
  attemptNumber Int           @default(1)
  externalId    String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  merchant      Merchant        @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  customer      Customer?       @relation(fields: [customerId], references: [id], onDelete: SetNull)
  order         Order?          @relation(fields: [orderId], references: [id], onDelete: SetNull)
  events        PaymentEvent[]
  recoveryCases RecoveryCase[]

  @@unique([merchantId, externalId])
  @@index([merchantId])
  @@index([customerId])
  @@index([orderId])
  @@index([status])
}

model PaymentEvent {
  id         String            @id @default(uuid())
  paymentId  String
  type       PaymentEventType
  reason     String?
  metadata   Json?
  occurredAt DateTime          @default(now())

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
  @@index([type])
  @@index([occurredAt])
}

model Subscription {
  id                   String             @id @default(uuid())
  merchantId           String
  customerId           String
  amount               Decimal            @db.Decimal(18, 2)
  currency             String             @default("INR")
  status               SubscriptionStatus @default(ACTIVE)
  nextBillingAt        DateTime?
  failedPaymentCount   Int                @default(0)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([merchantId])
  @@index([customerId])
  @@index([status])
}

model Invoice {
  id         String        @id @default(uuid())
  merchantId String
  customerId String
  amount     Decimal       @db.Decimal(18, 2)
  currency   String        @default("INR")
  status     InvoiceStatus @default(ISSUED)
  dueDate    DateTime
  paidAt     DateTime?
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([merchantId])
  @@index([customerId])
  @@index([status])
  @@index([dueDate])
}

model RecoveryCase {
  id                 String             @id @default(uuid())
  merchantId         String
  customerId         String?
  paymentId          String?
  invoiceId          String?
  status             RecoveryCaseStatus @default(OPEN)
  riskLevel          RiskLevel?
  revenueAtRisk      Decimal            @db.Decimal(18, 2)
  recoveryProbability Decimal?          @db.Decimal(5, 4)
  rootCause          String?
  openedAt           DateTime           @default(now())
  closedAt           DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  merchant Merchant  @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  payment  Payment?  @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  actions  RecoveryAction[]
  outcome  RecoveryOutcome?
  auditLogs AuditLog[]

  @@index([merchantId])
  @@index([customerId])
  @@index([paymentId])
  @@index([status])
  @@index([riskLevel])
}

model RecoveryAction {
  id             String              @id @default(uuid())
  recoveryCaseId String
  type           RecoveryActionType
  status         RecoveryActionStatus @default(PENDING)
  reason         String?
  policyDecision PolicyAction?
  attemptedAt    DateTime?
  completedAt    DateTime?
  result         Json?
  createdAt      DateTime            @default(now())

  recoveryCase RecoveryCase @relation(fields: [recoveryCaseId], references: [id], onDelete: Cascade)

  @@index([recoveryCaseId])
  @@index([status])
  @@index([type])
}

model RecoveryOutcome {
  id             String   @id @default(uuid())
  recoveryCaseId String   @unique
  recoveredAmount Decimal  @db.Decimal(18, 2)
  successful     Boolean
  recoveryMethod RecoveryActionType?
  recoveredAt    DateTime?
  createdAt      DateTime @default(now())

  recoveryCase RecoveryCase @relation(fields: [recoveryCaseId], references: [id], onDelete: Cascade)
}

model Policy {
  id          String       @id @default(uuid())
  merchantId  String
  name        String
  description String?
  actionType  RecoveryActionType
  decision    PolicyAction
  maxRetries  Int?
  maxContacts Int?
  maxAmount   Decimal?     @db.Decimal(18, 2)
  enabled     Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  merchant Merchant @relation(fields: [merchantId], references: [id], onDelete: Cascade)

  @@index([merchantId])
  @@index([actionType])
}

model AuditLog {
  id             String   @id @default(uuid())
  merchantId     String
  recoveryCaseId String?
  action         String
  actorType      String
  actorId        String?
  details        Json?
  createdAt      DateTime @default(now())

  merchant     Merchant      @relation(fields: [merchantId], references: [id], onDelete: Cascade)
  recoveryCase RecoveryCase? @relation(fields: [recoveryCaseId], references: [id], onDelete: SetNull)

  @@index([merchantId])
  @@index([recoveryCaseId])
  @@index([createdAt])
}
```

That is good database design: **evolve the schema when the domain becomes clearer.**

---

# 1.15 One correction to the schema above

There is one relation we should add before migrating:

`Invoice` needs to be connected to `RecoveryCase`.

Add this field inside `RecoveryCase`:

```prisma
invoiceId String?
```

and add:

```prisma
invoice Invoice? @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
```

And inside `Invoice` add:

```prisma
recoveryCases RecoveryCase[]
```

So the relationship becomes:

```text
Invoice
   │
   └── RecoveryCase
```

This is necessary because our track explicitly includes **overdue receivables**.

---

# 1.16 Validate the schema

From:

```text
recoverai/backend
```

run:

```bash
npx prisma format
```

Then:

```bash
npx prisma validate
```

You want:

```text
The schema is valid
```

If Prisma reports an error, **don't continue**. Fix it first.

---

# 1.17 Create the actual PostgreSQL tables

Once validation passes:

```bash
npx prisma migrate dev --name init
```

Prisma Migrate will generate the SQL migration and apply it to your PostgreSQL database. ([NestJS Documentation][2])

You should now see:

```text
backend/
└── prisma/
    ├── schema.prisma
    └── migrations/
        └── <timestamp>_init/
            └── migration.sql
```

**Commit the migration to Git.**

Migrations are part of the source code of our database.

---

# 1.18 Generate Prisma Client

Run:

```bash
npx prisma generate
```

The generated client should appear under:

```text
backend/src/generated/prisma/
```

because that's the output path we configured.

---

# 1.19 Open the database visually

This is useful for you because you want to **understand what you're building**, not blindly trust code.

Run:

```bash
npx prisma studio
```

Prisma Studio lets you inspect the database visually. Prisma lists Studio as one of the standard next steps after setting up Prisma. ([Prisma][4])

You should see our tables/models.

Something approximately like:

```text
Merchant
MerchantUser
Customer
Order
Payment
PaymentEvent
Subscription
Invoice
RecoveryCase
RecoveryAction
RecoveryOutcome
Policy
AuditLog
```

---

# 1.20 What should exist at the end of Phase 1?

Your project should look roughly like:

```text
recoverai/
│
├── .git/
├── .gitignore
├── README.md
├── .env.example
├── docker-compose.yml
│
└── backend/
    │
    ├── .env                 ← NOT committed
    ├── package.json
    ├── nest-cli.json
    ├── tsconfig.json
    │
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   └── generated/
    │       └── prisma/
    │
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    │       └── ..._init/
    │           └── migration.sql
    │
    └── prisma.config.ts
```

And your running infrastructure:

```text
Docker
  │
  └── PostgreSQL
          │
          ▼
       RecoverAI
        database
```

---

# 1.21 Phase-1 completion test

Before you say **"Phase 1 done"**, verify these 7 things:

### Test 1

PostgreSQL is running:

```bash
docker ps
```

### Test 2

Prisma validates:

```bash
npx prisma validate
```

### Test 3

Migration exists:

```text
prisma/migrations/..._init/
```

### Test 4

Prisma Client generated:

```text
src/generated/prisma/
```

### Test 5

Prisma Studio opens:

```bash
npx prisma studio
```

### Test 6

Git does **not** track `.env`.

```bash
git status
```

Your `.env` should not appear as an untracked file.

### Test 7

The database contains the expected models.

---

We intentionally stop here.

Tomorrow:

# **PHASE 2 — Synthetic Data & Data Preparation**

And Phase 2 will be built **on top of this database**, not beside it.

The flow will then become:

```text
PHASE 0
Business definition
       ↓
PHASE 1
PostgreSQL + Prisma
       ↓
       ★ YOU ARE HERE
       ↓
PHASE 2
Synthetic data generation
       ↓
Database gets realistic merchants,
customers, payments, failures,
subscriptions, invoices, etc.
       ↓
PHASE 3
NestJS backend
```

One final important point: **don't try to understand the entire final RecoverAI system today.** Your only mental model for now is:

> **Phase 0 defines what the business objects mean. Phase 1 turns those objects into a reliable PostgreSQL data model.**

That's it. Once Phase 1 is actually running on your machine, we stop. Tomorrow we build the data that will make this database useful.

