import { test } from "node:test";
import assert from "node:assert/strict";
import { DB_PROBLEM_MESSAGES, describeDbError } from "./db-errors.ts";

test("Supabase's 'tenant/user not found' means the project is paused", () => {
  const render = new Error("Cannot connect to database: (ENOTFOUND) tenant/user postgres.abcdef not found.");
  assert.equal(describeDbError(render).kind, "paused");
  assert.equal(describeDbError(new Error("Tenant or user not found")).kind, "paused");
});

test("timeouts are reported as timeouts", () => {
  assert.equal(describeDbError(new Error("database did not respond within 15s")).kind, "timeout");
  assert.equal(describeDbError(new Error("write CONNECT_TIMEOUT host:6543")).kind, "timeout");
});

test("DNS and refused connections are unreachable", () => {
  assert.equal(describeDbError(new Error("getaddrinfo ENOTFOUND db.example.supabase.co")).kind, "unreachable");
  assert.equal(describeDbError(new Error("connect ECONNREFUSED 127.0.0.1:5432")).kind, "unreachable");
});

test("a missing DATABASE_URL is a configuration problem", () => {
  assert.equal(describeDbError(new Error("Missing required env var DATABASE_URL")).kind, "not_configured");
});

test("anything else is unknown, and every kind has a plain-language message", () => {
  const problem = describeDbError(new Error("syntax error at or near x"));
  assert.equal(problem.kind, "unknown");
  assert.equal(problem.message, DB_PROBLEM_MESSAGES.unknown);
  for (const message of Object.values(DB_PROBLEM_MESSAGES)) assert.ok(message.length > 20);
});
