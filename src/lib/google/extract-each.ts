import { withTimeout } from "../sync/with-timeout.ts";

/**
 * Extracts content for each file independently. A file whose extraction throws or
 * times out is SKIPPED (counted and logged), never returned with an empty body: the
 * caller upserts what it gets, and an empty body would overwrite the stored text and
 * clear its embedding. Skipped files keep their stored rows until the next sync.
 */
export async function extractEach<F extends { id?: string | null }>(
  files: F[],
  extract: (file: F) => Promise<string>,
  timeoutMs: number,
): Promise<{ extracted: { file: F; content: string }[]; skipped: number }> {
  const settled = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await withTimeout(Promise.resolve().then(() => extract(file)), timeoutMs, "Drive download");
        return { file, content };
      } catch (err) {
        console.error(`Skipping Drive file ${file.id ?? "(unknown)"}: its content could not be read`, err);
        return null;
      }
    }),
  );
  const extracted = settled.filter((r): r is { file: F; content: string } => r !== null);
  return { extracted, skipped: settled.length - extracted.length };
}
