/**
 * How long an Order can sit unpaid before Vidur treats it as an abandoned
 * checkout rather than a customer who's still mid-payment. Shared between
 * the scheduled sweep (CheckoutSweepService) and the on-demand batch
 * detector (RecoveryBatchesService) so both use the same real threshold —
 * neither should flag a checkout the instant it's created.
 */
const DEFAULT_GRACE_MINUTES = 20;

export function getCheckoutAbandonmentGraceMinutes(): number {
  const configured = Number(process.env.CHECKOUT_ABANDONMENT_GRACE_MINUTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_GRACE_MINUTES;
}

export function getCheckoutAbandonmentCutoff(): Date {
  return new Date(
    Date.now() - getCheckoutAbandonmentGraceMinutes() * 60 * 1000,
  );
}
