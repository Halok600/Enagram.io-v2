import { APICallError, RetryError } from "ai";

const QUOTA_MESSAGE = /quota|rate.?limit|resource.?exhausted/i;

/**
 * True when an embedding failure is the provider's quota or rate limit (HTTP 429, or a message
 * that says so), as opposed to a timeout, a server error or a bad response. The AI SDK wraps
 * the final failure of its retries in a RetryError, so unwrap that first.
 */
export function isQuotaError(err: unknown): boolean {
  const inner = RetryError.isInstance(err) ? err.lastError : err;
  if (!APICallError.isInstance(inner)) return false;
  return inner.statusCode === 429 || QUOTA_MESSAGE.test(inner.message);
}
