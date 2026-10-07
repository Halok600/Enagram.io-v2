type GoogleErrorLike = {
  code?: number | string;
  status?: number | string;
  message?: string;
  errors?: { reason?: string }[];
  response?: {
    status?: number;
    headers?: Headers | Record<string, string | string[] | undefined>;
    data?: { error?: { errors?: { reason?: string }[] } };
  };
};

function statusOf(err: GoogleErrorLike): number | undefined {
  for (const candidate of [err.response?.status, err.status, err.code]) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function reasonsOf(err: GoogleErrorLike): string[] {
  const all = [...(err.errors ?? []), ...(err.response?.data?.error?.errors ?? [])];
  return all.map((e) => e.reason ?? "").filter(Boolean);
}

/**
 * Google signals "slow down" as 429, 503, or a 403 carrying a rate-limit
 * reason — Gmail in particular answers per-user quota exhaustion with a 403
 * ("Quota exceeded for quota metric ...") rather than a 429. A plain 403
 * (e.g. insufficientPermissions) is deliberately NOT retryable: waiting never
 * fixes it, and friendly-error.ts needs to see it immediately.
 */
export function isRetryableGoogleError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as GoogleErrorLike;
  const status = statusOf(e);
  if (status === 429 || status === 503) return true;
  if (status === 403) {
    if (reasonsOf(e).some((r) => r === "rateLimitExceeded" || r === "userRateLimitExceeded")) return true;
    return /quota exceeded|rate limit/i.test(e.message ?? "");
  }
  return false;
}

function retryAfterMs(err: GoogleErrorLike): number | undefined {
  const headers = err.response?.headers;
  if (!headers) return undefined;
  const raw = typeof (headers as Headers).get === "function"
    ? (headers as Headers).get("retry-after")
    : (headers as Record<string, string | string[] | undefined>)["retry-after"];
  const seconds = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

export type BackoffOptions = {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries `fn` on Google rate-limit/transient errors with exponential
 * backoff plus up to 25% jitter, honoring Retry-After when Google sends it.
 * Total worst-case wait per call is ~15s at the defaults — bounded on purpose,
 * since this runs inside a serverless function.
 */
export async function withBackoff<T>(fn: () => Promise<T>, options: BackoffOptions = {}): Promise<T> {
  const { retries = 4, baseMs = 1000, maxMs = 8000, sleep = defaultSleep, random = Math.random } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryableGoogleError(err)) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const delay = retryAfterMs(err as GoogleErrorLike) ?? backoff + Math.floor(random() * backoff * 0.25);
      await sleep(Math.min(delay, maxMs));
    }
  }
}

/**
 * `Promise.all` over N items fires N requests at once — for a 100-message
 * Gmail sync that's 100 simultaneous `messages.get` calls, which is what trips
 * Gmail's per-user per-minute quota. This runs at most `limit` at a time,
 * keeps results in input order, and stops pulling new items after a failure.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;

  async function worker() {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
