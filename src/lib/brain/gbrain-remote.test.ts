import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.GBRAIN_REMOTE_URL = "http://brain.test/mcp";
process.env.GBRAIN_REMOTE_TOKEN = "test-token";
process.env.GBRAIN_MCP_TIMEOUT_MS = "50";

const { searchBrain, getPreferences, savePreference, forgetPreference, pingBrain } = await import("./gbrain-remote.ts");

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A server that accepts the connection and never answers — what a crash-looping Render service looks like. */
function stubHangingServer() {
  globalThis.fetch = ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    })) as typeof fetch;
}

function stubMcpResult(payload: unknown) {
  const body = `event: message\ndata: ${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
  })}\n\n`;
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  return calls;
}

test("searchBrain fails fast with a clear error when the gbrain server never answers", { timeout: 2000 }, async () => {
  stubHangingServer();
  await assert.rejects(searchBrain("hello"), /gbrain server did not respond/);
});

test("getPreferences degrades to [] instead of hanging the chat request", { timeout: 2000 }, async () => {
  stubHangingServer();
  assert.deepEqual(await getPreferences(), []);
});

test("save/forget preference never write when the read of existing preferences failed", { timeout: 2000 }, async () => {
  // A failed read must not look like "no preferences yet" — the follow-up put_page
  // would then replace every saved preference with just the new one.
  const toolsCalled: string[] = [];
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    const toolName = JSON.parse(String(init?.body)).params.name as string;
    toolsCalled.push(toolName);
    if (toolName === "get_page") {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    }
    return Promise.resolve(new Response("data: {}\n\n", { status: 200 }));
  }) as typeof fetch;

  await assert.rejects(savePreference("likes concise answers"), /did not respond/);
  await assert.rejects(forgetPreference("concise"), /did not respond/);
  assert.equal(toolsCalled.includes("put_page"), false);
});

test("every gbrain call carries an abort signal", async () => {
  const calls = stubMcpResult([]);
  await searchBrain("hello");
  assert.ok(calls.length >= 1);
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test("pingBrain reports ok when the server answers, even with page_not_found", async () => {
  stubMcpResult({ error: "page_not_found" });
  const result = await pingBrain();
  assert.equal(result.ok, true);
  assert.equal(typeof result.ms, "number");
});

test("pingBrain rejects when the server never answers", { timeout: 2000 }, async () => {
  stubHangingServer();
  await assert.rejects(pingBrain(), /gbrain server did not respond/);
});
