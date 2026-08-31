import { Injectable, InternalServerErrorException } from '@nestjs/common';

interface RecoveryPredictionInput {
  amount: number;
  failure_reason: string;
  payment_method: string;
  customer_history: number;
  previous_failures: number;
  previous_successes: number;
  customer_value: number;
  retry_count: number;
  retry_failed_events: number;
}

export interface RecoveryPredictionResponse {
  recovery_probability: number;
}

@Injectable()
export class MlService {
  private readonly mlServiceUrl =
    process.env.ML_SERVICE_URL ?? 'http://localhost:8001';

  async predictRecovery(
    input: RecoveryPredictionInput,
  ): Promise<RecoveryPredictionResponse> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/predict-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`ML service returned HTTP ${response.status}`);
      }

      return (await response.json()) as RecoveryPredictionResponse;
    } catch (error) {
      throw new InternalServerErrorException(
        'ML prediction service is unavailable.',
      );
    }
  }
}
