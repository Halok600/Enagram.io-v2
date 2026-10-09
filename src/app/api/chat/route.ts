import { google } from "@ai-sdk/google";
import {
  APICallError,
  RetryError,
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { requireSession } from "@/lib/auth-guard";
import { createBrainTools } from "@/lib/query/tools";
import { CHAT_MODEL_ID, getSystemPrompt } from "@/lib/query/config";
import { TOOL_APPROVAL_POLICY, resolveToolApprovalSecret } from "@/lib/query/approval";
import { createToolBudget } from "@/lib/query/tool-budget";
import { getBrain } from "@/lib/store/service";

// 60s is the max Vercel's Hobby plan allows. Needed as headroom: the model
// can call search_gmail/search_drive multiple times per turn, each one a
// round-trip to the database and the embedding API.
export const maxDuration = 60;

/**
 * Most Gemini API failures (rate limits, overload) surface DURING streaming,
 * not as a synchronous throw from `streamText()` itself — it returns
 * immediately and the actual model call happens lazily as the stream is
 * consumed. That's why this is wired into `toUIMessageStreamResponse`'s
 * `onError` (which controls the error text embedded in the stream) rather
 * than only a try/catch around `streamText()`. The AI SDK retries
 * transiently-retryable errors internally a few times first and wraps the
 * final failure in a `RetryError` — unwrap `.lastError` to get at the real
 * `APICallError` and its `statusCode`.
 */
function friendlyErrorMessage(error: unknown): string {
  const resolved = RetryError.isInstance(error) ? error.lastError : error;
  const statusCode = APICallError.isInstance(resolved) ? resolved.statusCode : undefined;

  if (statusCode === 429) {
    return "[ ERR_HIGH_DEMAND ] Model is currently experiencing high demand (rate limited). Please wait a moment and try your query again.";
  }
  if (statusCode === 503 || statusCode === 500) {
    return "[ ERR_SERVICE_OVERLOAD ] The model provider is temporarily overloaded. Please retry in a moment.";
  }
  if (statusCode !== undefined) {
    return `[ ERR_UPSTREAM_${statusCode} ] The model provider returned an unexpected error. Please try again.`;
  }

  console.error("Unclassified chat error", error);
  return "[ SYSTEM_ALERT ] Something went wrong generating a response. Please try again.";
}

/** A broken or paused database must not stop the chat from replying at all: continue without preferences. */
async function loadPreferences(): Promise<string[]> {
  try {
    return await (await getBrain()).getPreferences();
  } catch (err) {
    console.error("Preferences unavailable; continuing without them", err);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const { messages }: { messages: UIMessage[] } = await req.json();

    const startedAt = Date.now();
    const preferences = await loadPreferences();
    const systemPrompt = getSystemPrompt(preferences);

    const result = streamText({
      model: google(CHAT_MODEL_ID),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: createBrainTools(session.accessToken, session.user?.email ?? ""),
      stopWhen: stepCountIs(5),
      // Write tools stop and wait for an Approve click in the chat (see approval.ts), so text
      // inside an email cannot make the assistant change data on its own.
      toolApproval: TOOL_APPROVAL_POLICY,
      // Signs each approval request so a forged "approved" message from the browser is rejected.
      // Optional: unset or blank keeps approvals working, just unsigned.
      experimental_toolApprovalSecret: resolveToolApprovalSecret(process.env.TOOL_APPROVAL_SECRET),
      // See tool-budget.ts: once ~28s are spent, force an answer rather than
      // let more search steps run into Vercel's 60s kill with nothing shown.
      prepareStep: createToolBudget(systemPrompt, startedAt),
    });

    return result.toUIMessageStreamResponse({ onError: friendlyErrorMessage });
  } catch (err) {
    // Genuinely synchronous failures only (bad request body, auth, our own
    // code throwing before streamText is ever invoked) — model/API errors
    // are caught above via onError instead.
    console.error("Chat request failed before streaming started", err);
    return new Response(JSON.stringify({ error: friendlyErrorMessage(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
