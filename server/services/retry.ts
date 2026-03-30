import { logger } from "../lib/logger.js";

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message || "";
    return message.includes("SQLITE_BUSY") || message.includes("database is locked");
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => T,
  options: RetryOptions = { maxAttempts: 3, baseDelayMs: 100 }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return fn();
    } catch (error) {
      if (attempt === options.maxAttempts || !isTransientError(error)) {
        throw error;
      }

      const delay = options.baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(
        { attempt, maxAttempts: options.maxAttempts, delay, error: (error as Error).message },
        "Transient error, retrying..."
      );
      await sleep(delay);
    }
  }

  throw new Error("Retry exhausted");
}
