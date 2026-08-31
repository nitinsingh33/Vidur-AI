import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_POLICIES } from "../src/policy/default-policies";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Resolves to backend/data/synthetic regardless of execution directory
const DATA_DIR = path.resolve(__dirname, "../data/synthetic");

function load<T>(filename: string): T[] {
  const file = path.join(DATA_DIR, filename);

  if (!fs.existsSync(file)) {
    throw new Error(`Data file not found: ${file}. Please run backend/scripts/generate-data.py first.`);
  }

  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

async function main() {
  console.log("Starting RecoverAI synthetic database seed...");
  console.log(`Using DATA_DIR: ${DATA_DIR}`);

  const merchants = load<any>("merchants.json");
  const customers = load<any>("customers.json");
  const orders = load<any>("orders.json");
  const payments = load<any>("payments.json");
  const subscriptions = load<any>("subscriptions.json");
  const invoices = load<any>("invoices.json");
  const paymentEvents = load<any>("payment_events.json");

  console.log(`Merchants: ${merchants.length}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Orders: ${orders.length}`);
  console.log(`Payments: ${payments.length}`);
  console.log(`Subscriptions: ${subscriptions.length}`);
  console.log(`Invoices: ${invoices.length}`);
  console.log(`Payment events: ${paymentEvents.length}`);

  // Clear existing data in reverse dependency order
  await prisma.paymentEvent.deleteMany();
  await prisma.recoveryAction.deleteMany();
  await prisma.recoveryOutcome.deleteMany();
  await prisma.recoveryCase.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchantUser.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.merchant.deleteMany();

  console.log("Existing synthetic data cleared.");

  await prisma.merchant.createMany({
    data: merchants.map((m: any) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      currency: m.currency,
    })),
  });
  console.log("Merchants inserted.");

  await prisma.customer.createMany({
    data: customers.map((c: any) => ({
      id: c.id,
      merchantId: c.merchantId,
      externalId: c.externalId,
      name: c.name,
      email: c.email,
      phone: c.phone,
    })),
  });
  console.log("Customers inserted.");

  await prisma.order.createMany({
    data: orders.map((o: any) => ({
      id: o.id,
      merchantId: o.merchantId,
      customerId: o.customerId,
      amount: o.amount,
      currency: o.currency,
      status: "CREATED",
      createdAt: new Date(o.createdAt),
    })),
  });
  console.log("Orders inserted.");

  await prisma.payment.createMany({
    data: payments.map((p: any) => ({
      id: p.id,
      merchantId: p.merchantId,
      customerId: p.customerId,
      orderId: p.orderId,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      failureReason: p.failureReason,
      attemptNumber: p.attemptNumber,
      externalId: p.externalId,
    })),
  });
  console.log("Payments inserted.");

  await prisma.paymentEvent.createMany({
    data: paymentEvents.map((event: any) => ({
      id: event.id,
      paymentId: event.paymentId,
      type: event.type,
      reason: event.reason,
      metadata: event.metadata,
      occurredAt: new Date(event.occurredAt),
    })),
  });
  console.log("Payment events inserted.");

  await prisma.subscription.createMany({
    data: subscriptions.map((s: any) => ({
      id: s.id,
      merchantId: s.merchantId,
      customerId: s.customerId,
      amount: s.amount,
      currency: s.currency,
      status: s.status,
      nextBillingAt: new Date(s.nextBillingAt),
      failedPaymentCount: s.failedPaymentCount,
      createdAt: new Date(s.createdAt),
    })),
  });
  console.log("Subscriptions inserted.");

  await prisma.invoice.createMany({
    data: invoices.map((i: any) => ({
      id: i.id,
      merchantId: i.merchantId,
      customerId: i.customerId,
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      dueDate: new Date(i.dueDate),
      paidAt: i.paidAt ? new Date(i.paidAt) : null,
    })),
  });
  console.log("Invoices inserted.");

  await prisma.policy.createMany({
    data: merchants.flatMap((merchant: any) =>
      DEFAULT_POLICIES.map((policy) => ({
        merchantId: merchant.id,
        name: policy.name,
        description: policy.description,
        actionType: policy.actionType,
        decision: policy.decision,
        maxRetries: policy.maxRetries ?? null,
        maxContacts: policy.maxContacts ?? null,
        maxAmount: policy.maxAmount ?? null,
        retryIntervalMinutes: policy.retryIntervalMinutes ?? null,
        enabled: true,
      })),
    ),
  });

  console.log(
    `Policies inserted: ${DEFAULT_POLICIES.length} action types x ${merchants.length} merchants.`,
  );

  console.log("RecoverAI synthetic database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
