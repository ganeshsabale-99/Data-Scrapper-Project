import { isDbConnectivityError } from "./safeErrorResponse";

type DbRetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  context?: string;
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const withDbRetry = async <T>(
  action: () => Promise<T>,
  options: DbRetryOptions = {},
): Promise<T> => {
  const retries = Math.max(0, options.retries ?? 2);
  const maxDelayMs = Math.max(50, options.maxDelayMs ?? 1000);
  const backoffFactor = Math.max(1, options.backoffFactor ?? 2);
  const context = options.context || "db.retry";
  let delayMs = Math.max(50, options.initialDelayMs ?? 100);

  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      const shouldRetry = isDbConnectivityError(error) && attempt < retries;
      if (!shouldRetry) throw error;

      console.warn(`[${context}] transient database error, retrying`, {
        attempt: attempt + 1,
        maxAttempts: retries + 1,
        delayMs,
      });

      await sleep(delayMs);
      delayMs = Math.min(maxDelayMs, Math.round(delayMs * backoffFactor));
    }
  }
};

