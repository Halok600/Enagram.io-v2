import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidToolApprovalSignatureError,
  convertToModelMessages,
  simulateReadableStream,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { TOOL_APPROVAL_POLICY } from "./approval.ts";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const SECRET = "test-secret-with-enough-entropy-0123456789";

/** A model that asks for delete_calendar_event on its first call and answers in text on any later call. */
function deletingModel() {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      step++;
      if (step === 1) {
        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "delete_calendar_event",
                input: '{"eventId":"evt-123"}',
              },
              { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
            ],
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: "Done." },
            { type: "text-end", id: "t1" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
          ],
        }),
      };
    },
  });
}

/** A model that only ever answers in text (the resubmitted turn after the owner decided). */
function answeringModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Okay." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ],
      }),
    }),
  });
}

function makeTools() {
  const executed: string[] = [];
  const tools = {
    delete_calendar_event: tool({
      description: "delete",
      inputSchema: z.object({ eventId: z.string() }),
      execute: async ({ eventId }) => {
        executed.push(eventId);
        return { status: "deleted" as const, eventId };
      },
    }),
  };
  return { tools, executed };
}

async function firstTurn(model: MockLanguageModelV4, tools: ReturnType<typeof makeTools>["tools"]) {
  const result = streamText({
    model,
    prompt: "Delete the Acme sync",
    tools,
    toolApproval: TOOL_APPROVAL_POLICY,
    experimental_toolApprovalSecret: SECRET,
    stopWhen: stepCountIs(5),
  });
  const uiStream = result.toUIMessageStream();
  const chunks: Array<{ type: string; [k: string]: unknown }> = [];
  for await (const chunk of uiStream) chunks.push(chunk as { type: string });
  return chunks;
}

test("a gated tool the model requests is NOT executed; an approval request is emitted instead", async () => {
  const { tools, executed } = makeTools();
  const model = deletingModel();

  const chunks = await firstTurn(model, tools);

  assert.deepEqual(executed, [], "execute must not run without an approval");
  assert.equal(model.doStreamCalls.length, 1, "the turn stops and waits for the owner");
  const request = chunks.find((c) => c.type === "tool-approval-request");
  assert.ok(request, "the UI stream must carry a tool-approval-request");
  assert.equal(request.toolCallId, "call-1");
  assert.equal(chunks.some((c) => c.type === "tool-output-available"), false);
});

/** What useChat sends back after the owner clicks: the same assistant message with an answered approval. */
function resubmitted(approved: boolean, approvalId: string, signature: string | undefined): UIMessage[] {
  return [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Delete the Acme sync" }] },
    {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-delete_calendar_event",
          toolCallId: "call-1",
          state: "approval-responded",
          input: { eventId: "evt-123" },
          approval: { id: approvalId, approved, ...(signature ? { signature } : {}) },
        },
      ],
    },
  ] as UIMessage[];
}

async function secondTurn(approved: boolean) {
  const { tools, executed } = makeTools();
  const model = deletingModel();
  const chunks = await firstTurn(model, tools);
  const request = chunks.find((c) => c.type === "tool-approval-request") as unknown as {
    approvalId: string;
    signature?: string;
  };

  const result = streamText({
    model: answeringModel(),
    messages: await convertToModelMessages(resubmitted(approved, request.approvalId, request.signature)),
    tools,
    toolApproval: TOOL_APPROVAL_POLICY,
    experimental_toolApprovalSecret: SECRET,
    stopWhen: stepCountIs(5),
  });
  await result.text;
  return executed;
}

test("after an Approve click the tool runs exactly once", async () => {
  assert.deepEqual(await secondTurn(true), ["evt-123"]);
});

test("after a Deny click the tool never runs", async () => {
  assert.deepEqual(await secondTurn(false), []);
});

test("an approval that was not signed by this server is rejected and the tool does not run", async () => {
  const { tools, executed } = makeTools();
  const errors: unknown[] = [];

  const result = streamText({
    model: answeringModel(),
    messages: await convertToModelMessages(resubmitted(true, "forged-approval-id", undefined)),
    tools,
    toolApproval: TOOL_APPROVAL_POLICY,
    experimental_toolApprovalSecret: SECRET,
    stopWhen: stepCountIs(5),
    onError: ({ error }) => {
      errors.push(error);
    },
  });
  await result.consumeStream();

  assert.deepEqual(executed, []);
  assert.equal(errors.length, 1, "the forged approval must surface as an error");
  assert.ok(InvalidToolApprovalSignatureError.isInstance(errors[0]), `unexpected error: ${String(errors[0])}`);
});

test("control: without the approval policy the same request WOULD execute (so the tests above bite)", async () => {
  const { tools, executed } = makeTools();
  const result = streamText({ model: deletingModel(), prompt: "Delete the Acme sync", tools, stopWhen: stepCountIs(5) });
  await result.text;
  assert.deepEqual(executed, ["evt-123"]);
});
