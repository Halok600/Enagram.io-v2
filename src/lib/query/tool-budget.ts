/**
 * Vercel kills /api/chat at 60s (maxDuration) and nothing is shown until the
 * model writes its answer. Each tool step is a Gemini round-trip plus a store
 * search (~7s warm, 15-17s cold), and the system prompt
 * tells the model to call every tool a question could span, so a plain
 * "TCS mail?" can fan out across Gmail + Drive + Calendar + find_related and
 * run out the clock with no answer at all (seen live 2026-10-07).
 *
 * Once this much time is spent, the next step is forbidden from calling tools
 * so the model has to answer from what it already has. Sized to leave room
 * for one more in-flight tool step plus the final answer inside the 60s cap.
 */
export const TOOL_BUDGET_MS = 28_000;

const OUT_OF_TIME_NOTE =
  "You are out of time for searching. Do NOT call any more tools. Answer now using only what the " +
  "searches above already returned. Briefly tell the user which connected sources you did not get to " +
  "search, so they can ask a narrower follow-up (e.g. name the sender or subject).";

export function createToolBudget(baseInstructions: string, startedAt = Date.now(), now: () => number = Date.now) {
  return () =>
    now() - startedAt >= TOOL_BUDGET_MS
      ? { toolChoice: "none" as const, instructions: `${baseInstructions}\n\n${OUT_OF_TIME_NOTE}` }
      : {};
}
