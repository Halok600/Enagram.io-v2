import { test } from "node:test";
import assert from "node:assert/strict";
import { createToolBudget, TOOL_BUDGET_MS } from "./tool-budget.ts";

const BASE = "You are Enagram.io.";

test("leaves the step untouched while time remains in the budget", () => {
  const prepareStep = createToolBudget(BASE, 1_000, () => 1_000 + TOOL_BUDGET_MS - 1);
  assert.deepEqual(prepareStep(), {});
});

test("once the budget is spent, forbids further tool calls and tells the model to answer now", () => {
  const prepareStep = createToolBudget(BASE, 1_000, () => 1_000 + TOOL_BUDGET_MS);
  const result = prepareStep() as { toolChoice?: string; instructions?: string };
  assert.equal(result.toolChoice, "none");
  assert.ok(result.instructions?.startsWith(BASE), "must keep the original system prompt");
  assert.match(result.instructions ?? "", /out of time/i);
  assert.match(result.instructions ?? "", /did not (get to )?search/i);
});

test("the budget leaves room under Vercel's 60s cap for one more tool step plus the answer", () => {
  assert.ok(TOOL_BUDGET_MS <= 30_000);
  assert.ok(TOOL_BUDGET_MS >= 15_000);
});
