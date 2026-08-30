import { RiskEngineService } from './risk-engine.service';

describe('RiskEngineService', () => {
  let service: RiskEngineService;

  beforeEach(() => {
    service = new RiskEngineService();
  });

  it('should calculate risk for a reliable first-attempt failed payment', () => {
    const result = service.assess({
      amount: 50000,
      attemptNumber: 1,
      successfulPaymentCount: 5,
      failedPaymentCount: 0,
    });

    expect(result.recoveryProbability).toBe(0.8);
    expect(result.expectedLoss).toBe(10000);
    expect(result.revenueAtRisk).toBe(50000);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('should classify repeated failures as critical exposure', () => {
    const result = service.assess({
      amount: 50000,
      attemptNumber: 3,
      successfulPaymentCount: 0,
      failedPaymentCount: 4,
    });

    expect(result.recoveryProbability).toBe(0.1);
    expect(result.expectedLoss).toBe(45000);
    expect(result.revenueAtRisk).toBe(50000);
    expect(result.riskLevel).toBe('CRITICAL');
  });

  it('should clamp recovery probability to the configured range', () => {
    const result = service.assess({
      amount: 1000,
      attemptNumber: 10,
      successfulPaymentCount: 0,
      failedPaymentCount: 10,
    });

    expect(result.recoveryProbability).toBe(0.1);
  });
});
