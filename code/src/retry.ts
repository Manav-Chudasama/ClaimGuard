// ─── Retry with Exponential Backoff ─────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (cap) */
  maxDelayMs: number;
  /** Backoff multiplier (e.g. 2 for doubling) */
  backoffMultiplier: number;
  /** Random jitter range in milliseconds */
  jitterMs: number;
  /** Optional callback for logging retries */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Non-retryable HTTP status codes.
 * 400 = bad request (our fault, retrying won't help)
 * 401 = unauthorized (wrong API key)
 * 403 = forbidden
 * 404 = not found
 */
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404]);

/**
 * Check if an error is retryable.
 * - 429 (rate limit) → retryable
 * - 500+ (server error) → retryable
 * - Network errors → retryable
 * - 400, 401, 403, 404 → NOT retryable
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    // OpenAI SDK errors typically have a 'status' property
    const status = (error as any).status;
    if (typeof status === "number") {
      if (NON_RETRYABLE_STATUS_CODES.has(status)) {
        return false;
      }
      // 429 rate limit or 5xx server errors are retryable
      if (status === 429 || status >= 500) {
        return true;
      }
    }

    // Network errors (connection refused, timeout, etc.)
    const message = error.message.toLowerCase();
    if (
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("socket hang up")
    ) {
      return true;
    }

    // JSON parse errors from malformed VLM responses → retryable
    if (
      message.includes("json") ||
      message.includes("unexpected token") ||
      message.includes("zod") ||
      message.includes("validation")
    ) {
      return true;
    }
  }

  // Default: assume retryable (be resilient)
  return true;
}

/**
 * Extract retry-after delay from rate limit errors (if available).
 */
function getRetryAfterMs(error: unknown): number | null {
  if (error instanceof Error) {
    const headers = (error as any).headers;
    if (headers) {
      const retryAfter =
        headers.get?.("retry-after") ?? headers["retry-after"];
      if (retryAfter) {
        const seconds = parseFloat(retryAfter);
        if (!isNaN(seconds)) {
          return seconds * 1000;
        }
      }
    }
  }
  return null;
}

/**
 * Compute delay for a given attempt using exponential backoff with jitter.
 */
function computeDelay(attempt: number, options: RetryOptions): number {
  // Exponential: base * multiplier^attempt
  const exponentialDelay =
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);

  // Cap at maxDelayMs
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add random jitter
  const jitter = Math.random() * options.jitterMs;

  return cappedDelay + jitter;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry logic.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Honors retry-after headers from rate limit responses
 * - Skips retry for non-retryable errors (400, 401, etc.)
 * - Configurable max retries, delays, and callbacks
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw immediately
      if (attempt === options.maxRetries) {
        break;
      }

      // If the error is not retryable, throw immediately
      if (!isRetryable(error)) {
        throw lastError;
      }

      // Compute delay: prefer retry-after header, otherwise use exponential backoff
      const retryAfterMs = getRetryAfterMs(error);
      const delayMs = retryAfterMs ?? computeDelay(attempt, options);

      // Log the retry
      if (options.onRetry) {
        options.onRetry(attempt + 1, lastError, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError!;
}
