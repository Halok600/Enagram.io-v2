import { test } from "node:test";
import assert from "node:assert/strict";
import { stepCountIs, streamText, simulateReadableStream, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { createToolBudget, TOOL_BUDGET_MS } from "./tool-budget.ts";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

test("after the budget is spent mid-turn, the SDK sends the next step with tools disabled", async () => {
  let clock = 0;
  let step = 0;

  const model = new MockLanguageModelV4({
    doStream: async () => {
      step++;
      if (step === 1) {
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "tool-call", toolCallId: "c1", toolName: "search", input: '{"q":"acme"}' },
              { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
            ],
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: "Here is what I found so far." },
            { type: "text-end", id: "t1" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
          ],
        }),
      };
    },
  });

  const result = streamText({
    model,
    system: "BASE PROMPT",
    prompt: "Update me for the Acme mail?",
    tools: {
      search: tool({
        description: "search",
        inputSchema: z.object({ q: z.string() }),
        // A slow search: by the time it returns, the time budget is gone.
        execute: async () => {
          clock = TOOL_BUDGET_MS + 1;
          return { count: 0, results: [] };
        },
      }),
    },
    stopWhen: stepCountIs(5),
    prepareStep: createToolBudget("BASE PROMPT", 0, () => clock),
  });

  assert.equal(await result.text, "Here is what I found so far.");

  assert.equal(model.doStreamCalls.length, 2);
  assert.notEqual(model.doStreamCalls[0].toolChoice?.type, "none", "step 1 must still be allowed to search");
  assert.equal(model.doStreamCalls[1].toolChoice?.type, "none", "step 2 must be forced to answer");
  assert.match(JSON.stringify(model.doStreamCalls[1].prompt), /out of time for searching/i);
});
