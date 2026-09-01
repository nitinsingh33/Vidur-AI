/**
 * Runs `worker` over `items` with at most `limit` running concurrently,
 * rather than firing every item at once. Used to throttle bursts of
 * runAutomaticRecovery() calls from sweep loops — each one triggers a real
 * outbound call to the AI agent's /diagnose endpoint (Gemini), and firing
 * hundreds at once is what exhausts Gemini's rate limit (see
 * RecoveryAutoOrchestratorService.generateAiDiagnosis).
 *
 * A failing item is caught and swallowed so it can never stop the rest of
 * the queue from being processed — runAutomaticRecovery already never
 * throws by contract, but this holds regardless.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  async function drain(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;

      try {
        await worker(item);
      } catch {
        // Swallowed — see doc comment above.
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => drain()));
}
