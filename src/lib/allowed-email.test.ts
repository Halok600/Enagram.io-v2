import { test } from "node:test";
import assert from "node:assert/strict";
import { isEmailAllowed, parseAllowedEmails } from "./allowed-email.ts";

test("an unset or empty allowlist means unrestricted (the pre-existing behaviour)", () => {
  assert.equal(isEmailAllowed("anyone@example.com", undefined), true);
  assert.equal(isEmailAllowed("anyone@example.com", ""), true);
  assert.equal(isEmailAllowed(undefined, undefined), true);
});

test("when set, only listed emails are allowed, case-insensitively and ignoring spaces", () => {
  const list = " Owner@Gmail.com , second@example.com ";
  assert.equal(isEmailAllowed("owner@gmail.com", list), true);
  assert.equal(isEmailAllowed("SECOND@example.com", list), true);
  assert.equal(isEmailAllowed("stranger@gmail.com", list), false);
});

test("when set, a missing email is rejected", () => {
  assert.equal(isEmailAllowed(undefined, "owner@gmail.com"), false);
  assert.equal(isEmailAllowed(null, "owner@gmail.com"), false);
  assert.equal(isEmailAllowed("", "owner@gmail.com"), false);
});

test("parseAllowedEmails trims, lowercases and drops blanks", () => {
  assert.deepEqual(parseAllowedEmails(" A@x.com,, b@X.com ,"), ["a@x.com", "b@x.com"]);
  assert.deepEqual(parseAllowedEmails(undefined), []);
});
