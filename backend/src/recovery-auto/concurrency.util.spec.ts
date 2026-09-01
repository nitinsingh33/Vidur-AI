import { runWithConcurrency } from './concurrency.util';

describe('runWithConcurrency', () => {
  it('never runs more than `limit` workers at once', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency(items, 3, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('processes every item exactly once — none skipped, none dropped', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const seen: number[] = [];

    await runWithConcurrency(items, 3, async (item) => {
      seen.push(item);
    });

    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it("one item's failure does not stop the others from being processed", async () => {
    const items = [1, 2, 3, 4, 5];
    const processed: number[] = [];

    await runWithConcurrency(items, 3, async (item) => {
      if (item === 3) {
        throw new Error('boom');
      }
      processed.push(item);
    });

    expect(processed.sort()).toEqual([1, 2, 4, 5]);
  });

  it('never throws even when every item fails', async () => {
    const items = [1, 2, 3];

    await expect(
      runWithConcurrency(items, 3, async () => {
        throw new Error('always fails');
      }),
    ).resolves.toBeUndefined();
  });
});
