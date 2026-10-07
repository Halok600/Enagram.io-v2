export type StepTiming = { call: string; ok: boolean; ms: number; error?: string };

/** Runs steps one at a time (so timings do not overlap), recording each failure instead of throwing. */
export async function timeSteps(
  steps: { call: string; run: () => Promise<unknown> }[],
  now: () => number = Date.now,
): Promise<StepTiming[]> {
  const timings: StepTiming[] = [];
  for (const step of steps) {
    const start = now();
    try {
      await step.run();
      timings.push({ call: step.call, ok: true, ms: now() - start });
    } catch (err) {
      timings.push({
        call: step.call,
        ok: false,
        ms: now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return timings;
}
