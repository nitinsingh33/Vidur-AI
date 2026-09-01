import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface FashionKartResetSummary {
  ordersDeleted: number;
  paymentsDeleted: number;
  paymentEventsDeleted: number;
  subscriptionsDeleted: number;
  invoicesDeleted: number;
  mandatesDeleted: number;
  recoveryCasesDeleted: number;
  recoveryActionsDeleted: number;
  recoveryOutcomesDeleted: number;
  promisesToPayDeleted: number;
  auditLogsDeleted: number;
}

const EMPTY_SUMMARY: FashionKartResetSummary = {
  ordersDeleted: 0,
  paymentsDeleted: 0,
  paymentEventsDeleted: 0,
  subscriptionsDeleted: 0,
  invoicesDeleted: 0,
  mandatesDeleted: 0,
  recoveryCasesDeleted: 0,
  recoveryActionsDeleted: 0,
  recoveryOutcomesDeleted: 0,
  promisesToPayDeleted: 0,
  auditLogsDeleted: 0,
};

/**
 * Deletes only the demo-tagged transactional data (isDemoData = true) that
 * FashionKart's own storefront checkout, "Razorpay Live Demo" page, and
 * Recovery Lab created — never a broad "wipe everything for this merchant"
 * query. See RazorpayService.createCheckoutOrder / RecoveryLabService /
 * DemoService for where that tag is actually set.
 *
 * Two independent gates, both required:
 *  1. The caller must be an ADMIN of the merchant they're resetting
 *     (enforced by DemoController, from the JWT — never a request body).
 *  2. That merchant must itself be flagged Merchant.isDemoMerchant — this
 *     method refuses to run on any other merchant even if somehow called
 *     with its id, independent of the controller-level role check.
 *
 * Every existing row defaults isDemoData/isDemoMerchant to false, so
 * historical data that predates this feature (or that was never created
 * through a tagged path) is never a candidate for deletion — there is no
 * retroactive classification here, by design.
 */
@Injectable()
export class FashionKartDemoResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async reset(
    merchantId: string,
    actor: { id: string },
  ): Promise<FashionKartResetSummary> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { isDemoMerchant: true },
    });

    if (!merchant?.isDemoMerchant) {
      throw new ForbiddenException(
        'This merchant is not the dedicated demo tenant — reset refused.',
      );
    }

    const [demoOrders, standaloneDemoPayments, demoSubscriptions, demoInvoices, demoMandates] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { merchantId, isDemoData: true },
          select: { id: true },
        }),
        this.prisma.payment.findMany({
          where: { merchantId, isDemoData: true },
          select: { id: true },
        }),
        this.prisma.subscription.findMany({
          where: { merchantId, isDemoData: true },
          select: { id: true },
        }),
        this.prisma.invoice.findMany({
          where: { merchantId, isDemoData: true },
          select: { id: true },
        }),
        this.prisma.mandate.findMany({
          where: { merchantId, isDemoData: true },
          select: { id: true },
        }),
      ]);

    const orderIds = demoOrders.map((o) => o.id);
    const subscriptionIds = demoSubscriptions.map((s) => s.id);
    const invoiceIds = demoInvoices.map((i) => i.id);
    const mandateIds = demoMandates.map((m) => m.id);

    // Order-linked payments (a real checkout failure caught by the
    // payment.failed webhook) are found transitively via their Order —
    // they need no isDemoData of their own. Combined with the standalone
    // ones (Recovery Lab's payment-degradation scenario, the legacy demo
    // trigger) for the full payment set this reset owns.
    const orderLinkedPayments = orderIds.length
      ? await this.prisma.payment.findMany({
          where: { merchantId, orderId: { in: orderIds } },
          select: { id: true },
        })
      : [];

    const paymentIds = Array.from(
      new Set([
        ...standaloneDemoPayments.map((p) => p.id),
        ...orderLinkedPayments.map((p) => p.id),
      ]),
    );

    if (
      orderIds.length === 0 &&
      paymentIds.length === 0 &&
      subscriptionIds.length === 0 &&
      invoiceIds.length === 0 &&
      mandateIds.length === 0
    ) {
      return EMPTY_SUMMARY;
    }

    const demoCases = await this.prisma.recoveryCase.findMany({
      where: {
        merchantId,
        OR: [
          orderIds.length ? { orderId: { in: orderIds } } : undefined,
          paymentIds.length ? { paymentId: { in: paymentIds } } : undefined,
          subscriptionIds.length
            ? { subscriptionId: { in: subscriptionIds } }
            : undefined,
          invoiceIds.length ? { invoiceId: { in: invoiceIds } } : undefined,
          mandateIds.length ? { mandateId: { in: mandateIds } } : undefined,
        ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
      },
      select: { id: true },
    });

    const caseIds = demoCases.map((c) => c.id);

    // Pre-count cascade-deleted rows (DB-level ON DELETE CASCADE on
    // RecoveryCase -> RecoveryAction/RecoveryOutcome/PromiseToPay, and on
    // Payment -> PaymentEvent) so the summary can report them honestly —
    // Prisma's deleteMany count only reflects the table it directly targets.
    const [
      recoveryActionsCount,
      recoveryOutcomesCount,
      promisesToPayCount,
      paymentEventsCount,
    ] = await Promise.all([
      caseIds.length
        ? this.prisma.recoveryAction.count({
            where: { recoveryCaseId: { in: caseIds } },
          })
        : Promise.resolve(0),
      caseIds.length
        ? this.prisma.recoveryOutcome.count({
            where: { recoveryCaseId: { in: caseIds } },
          })
        : Promise.resolve(0),
      caseIds.length
        ? this.prisma.promiseToPay.count({
            where: { recoveryCaseId: { in: caseIds } },
          })
        : Promise.resolve(0),
      paymentIds.length
        ? this.prisma.paymentEvent.count({
            where: { paymentId: { in: paymentIds } },
          })
        : Promise.resolve(0),
    ]);

    const [
      auditLogsDeleted,
      recoveryCasesDeleted,
      paymentsDeleted,
      ordersDeleted,
      subscriptionsDeleted,
      invoicesDeleted,
      mandatesDeleted,
    ] = await this.prisma.$transaction([
      this.prisma.auditLog.deleteMany({
        where: { recoveryCaseId: { in: caseIds } },
      }),
      this.prisma.recoveryCase.deleteMany({
        where: { id: { in: caseIds } },
      }),
      // Payments must be deleted before their Orders — Payment.order is
      // onDelete: SetNull, not Cascade, so deleting the Order first would
      // only orphan the Payment rather than remove them.
      this.prisma.payment.deleteMany({
        where: { merchantId, id: { in: paymentIds } },
      }),
      this.prisma.order.deleteMany({
        where: { merchantId, id: { in: orderIds } },
      }),
      this.prisma.subscription.deleteMany({
        where: { merchantId, id: { in: subscriptionIds } },
      }),
      this.prisma.invoice.deleteMany({
        where: { merchantId, id: { in: invoiceIds } },
      }),
      this.prisma.mandate.deleteMany({
        where: { merchantId, id: { in: mandateIds } },
      }),
    ]);

    const summary: FashionKartResetSummary = {
      ordersDeleted: ordersDeleted.count,
      paymentsDeleted: paymentsDeleted.count,
      paymentEventsDeleted: paymentEventsCount,
      subscriptionsDeleted: subscriptionsDeleted.count,
      invoicesDeleted: invoicesDeleted.count,
      mandatesDeleted: mandatesDeleted.count,
      recoveryCasesDeleted: recoveryCasesDeleted.count,
      recoveryActionsDeleted: recoveryActionsCount,
      recoveryOutcomesDeleted: recoveryOutcomesCount,
      promisesToPayDeleted: promisesToPayCount,
      auditLogsDeleted: auditLogsDeleted.count,
    };

    // Recorded after the transaction, same convention as DemoService.reset —
    // this row necessarily post-dates the audit rows the reset itself just
    // removed.
    await this.auditService.record({
      merchantId,
      action: 'FASHIONKART_DEMO_RESET',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: { ...summary },
    });

    return summary;
  }
}
