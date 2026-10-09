import { test } from "node:test";
import assert from "node:assert/strict";
import { getSystemPrompt } from "./config.ts";

test("the prompt tells the model not to retry an action the owner declined", () => {
  assert.match(getSystemPrompt(), /declines? [^]*(do not|never|must not) retry/i);
});
