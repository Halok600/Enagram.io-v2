import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyClientError } from "./client-errors.ts";

test("an expired Google session becomes a reconnect instruction", () => {
  for (const raw of [
    '{"error":"RefreshAccessTokenError"}',
    '{"error":"Not authenticated"}',
    '{"error":"MissingRefreshToken"}',
  ]) {
    assert.match(friendlyClientError(raw), /Disconnect.*connect your Google account again/);
  }
});

test("a non-allowlisted account becomes a sign-in-with-the-owner instruction, not raw JSON", () => {
  const friendly = friendlyClientError('{"error":"This Google account is not allowed to use this app"}');
  assert.match(friendly, /not allowed to use this app/i);
  assert.match(friendly, /Disconnect.*sign in with the owner account/);
  assert.ok(!friendly.includes("{"));
});

test("other errors pass through unchanged", () => {
  assert.equal(friendlyClientError("[ ERR_HIGH_DEMAND ] try again"), "[ ERR_HIGH_DEMAND ] try again");
});
