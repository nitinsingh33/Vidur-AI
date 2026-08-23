import { Injectable } from '@nestjs/common';
import { RiskLevel } from '../generated/prisma/enums';

export interface RiskAssessmentInput {
    amount: number;
    attemptNumber: number;
    successfulPaymentCount: number;
    failedPaymentCount: number;
}

export interface RiskAssessment {
    recoveryProbability: number;
    expectedLoss: number;
    revenueAtRisk: number;
    riskLevel: RiskLevel;
}

@Injectable()
export class RiskEngineService {
    assess(input: RiskAssessmentInput): RiskAssessment {
        let recoveryProbability = 0.5;

        if (input.successfulPaymentCount >= 3) {
            recoveryProbability += 0.2;
        }

        if (input.attemptNumber === 1) {
            recoveryProbability += 0.1;
        }

        if (input.attemptNumber > 1) {
            recoveryProbability -= 0.15 * (input.attemptNumber - 1);
        }

        if (input.failedPaymentCount >= 3) {
            recoveryProbability -= 0.15;
        }

        recoveryProbability = Number(
            this.clamp(recoveryProbability, 0.1, 0.9).toFixed(4),
        );

        const expectedLoss = Number(
            (input.amount * (1 - recoveryProbability)).toFixed(2),
        );

        return {
            recoveryProbability,
            expectedLoss,
            revenueAtRisk: expectedLoss,
            riskLevel: this.getRiskLevel(expectedLoss),
        };
    }

    private getRiskLevel(expectedLoss: number): RiskLevel {
        if (expectedLoss >= 25000) {
            return RiskLevel.CRITICAL;
        }

        if (expectedLoss >= 10000) {
            return RiskLevel.HIGH;
        }

        if (expectedLoss >= 2500) {
            return RiskLevel.MEDIUM;
        }

        return RiskLevel.LOW;
    }

    private clamp(
        value: number,
        min: number,
        max: number,
    ): number {
        return Math.min(Math.max(value, min), max);
    }
}