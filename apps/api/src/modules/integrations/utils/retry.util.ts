export async function withRetry<T>(
  action: () => Promise<T>,
  options: { retries?: number; timeoutMs?: number } = {},
) {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 5000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Integration timeout')), timeoutMs),
        ),
      ]);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
