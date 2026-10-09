import { test } from "node:test";
import assert from "node:assert/strict";
import { APPROVAL_GATED_TOOLS, TOOL_APPROVAL_POLICY, resolveToolApprovalSecret } from "./approval.ts";

const EXPECTED_WRITE_TOOLS = [
  "create_calendar_event",
  "delete_calendar_event",
  "forget_preference",
  "save_preference",
  "update_calendar_event",
];

test("exactly the five write tools are gated", () => {
  assert.deepEqual([...APPROVAL_GATED_TOOLS].sort(), EXPECTED_WRITE_TOOLS);
  assert.deepEqual(Object.keys(TOOL_APPROVAL_POLICY).sort(), EXPECTED_WRITE_TOOLS);
});

test("every gated tool needs an explicit user approval", () => {
  for (const name of APPROVAL_GATED_TOOLS) {
    assert.equal(TOOL_APPROVAL_POLICY[name], "user-approval", name);
  }
});

test("read tools and the draft-only Gmail tool are not gated", () => {
  for (const name of ["search_gmail", "search_drive", "search_calendar", "find_related", "draft_gmail_reply"]) {
    assert.ok(!(name in TOOL_APPROVAL_POLICY), `${name} must stay automatic`);
  }
});

test("the secret is passed through when set", () => {
  assert.equal(resolveToolApprovalSecret("abc123"), "abc123");
});

test("an unset secret yields undefined", () => {
  assert.equal(resolveToolApprovalSecret(undefined), undefined);
});

test("an empty or whitespace-only secret yields undefined", () => {
  assert.equal(resolveToolApprovalSecret(""), undefined);
  assert.equal(resolveToolApprovalSecret("   \n\t"), undefined);
});
