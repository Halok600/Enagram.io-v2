import { GoogleFetchError } from "./errors.ts";
import { withTimeout } from "./with-timeout.ts";

/**
 * Runs the Google fetch under a time limit. A failure OR a timeout rejects as a
 * GoogleFetchError (never a partial or empty result), so the fetch phase aborts
 * before it can delete anything from a window it did not fully read.
 */
export async function guardGoogleFetch<T>(fetchAll: () => Promise<T>, timeoutMs: number): Promise<T> {
  try {
    return await withTimeout(Promise.resolve().then(fetchAll), timeoutMs, "Google fetch");
  } catch (err) {
    throw new GoogleFetchError(err);
  }
}
