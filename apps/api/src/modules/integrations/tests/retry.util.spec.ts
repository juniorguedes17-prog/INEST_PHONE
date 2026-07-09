import { describe, expect, it } from 'vitest';
import { withRetry } from '../utils/retry.util';

describe('withRetry', () => {
  it('retries a transient integration failure', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('temporary failure');
        }
        return 'ok';
      },
      { retries: 2, timeoutMs: 100 },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws the last error after all retries fail', async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error('permanent failure');
        },
        { retries: 1, timeoutMs: 100 },
      ),
    ).rejects.toThrow('permanent failure');
  });
});
