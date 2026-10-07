/**
 * Memoizes an async factory: concurrent callers share one in-flight promise and a
 * success is cached, but a FAILURE IS NOT CACHED — the next call retries. This is what
 * lets the app recover once a paused database is restored, without a redeploy.
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = (async () => factory())().catch((err) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}
