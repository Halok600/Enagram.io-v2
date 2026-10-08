/**
 * Rejects if `promise` has not settled within `ms`. The underlying work is not cancelled (a
 * fetch or embedding call keeps running in the background); this only stops the caller waiting,
 * so one slow call cannot hold a Vercel function past its limit.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took longer than ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
