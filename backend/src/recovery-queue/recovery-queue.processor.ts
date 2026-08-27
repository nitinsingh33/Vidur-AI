import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL ?? 'http://localhost:8001';

@Processor('recovery')
export class RecoveryQueueProcessor extends WorkerHost {
  async process(
    job: Job<{ recoveryCaseId: string }>,
  ) {
    const { recoveryCaseId } = job.data;

    console.log(
      `Recovery job started: ${job.id}`,
    );

    console.log(
      `Recovery case: ${recoveryCaseId}`,
    );

    const response = await fetch(
      `${AGENT_SERVICE_URL}/run-recovery`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recovery_case_id: recoveryCaseId,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `Agent recovery request failed: ${response.status} ${errorBody}`,
      );
    }

    const result = await response.json();

    console.log(
      `Recovery job completed: ${job.id}`,
    );

    return result;
  }
}