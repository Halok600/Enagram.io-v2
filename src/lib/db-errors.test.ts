import { test } from "node:test";
import assert from "node:assert/strict";
import { DB_PROBLEM_MESSAGES, MISSING_DATABASE_URL_MESSAGE, describeDbError } from "./db-errors.ts";

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

test("Node network errors map by their code or message", () => {
  assert.equal(describeDbError(new Error("connect ETIMEDOUT 10.0.0.1:6543")).kind, "timeout");
  assert.equal(describeDbError(new Error("connect EHOSTUNREACH 10.0.0.1:6543")).kind, "unreachable");
  assert.equal(describeDbError(new Error("connect ENETUNREACH ::1:6543")).kind, "unreachable");
});

test("postgres.js connection errors map by their code", () => {
  const withCode = (code: string) => Object.assign(new Error("write failed"), { code });
  assert.equal(describeDbError(withCode("CONNECT_TIMEOUT")).kind, "timeout");
  assert.equal(describeDbError(withCode("ETIMEDOUT")).kind, "timeout");
  assert.equal(describeDbError(withCode("EHOSTUNREACH")).kind, "unreachable");
  assert.equal(describeDbError(withCode("ENETUNREACH")).kind, "unreachable");
  assert.equal(describeDbError(withCode("CONNECTION_CLOSED")).kind, "unreachable");
  assert.equal(describeDbError(withCode("CONNECTION_DESTROYED")).kind, "unreachable");
  assert.equal(describeDbError(withCode("CONNECTION_ENDED")).kind, "unreachable");
});

test("a cause or AggregateError member decides the kind when the outer error is generic", () => {
  const inner = Object.assign(new Error("connect ETIMEDOUT 10.0.0.1:6543"), { code: "ETIMEDOUT" });
  assert.equal(describeDbError(new Error("query failed", { cause: inner })).kind, "timeout");
  const refused = Object.assign(new Error("connect ECONNREFUSED ::1:5432"), { code: "ECONNREFUSED" });
  assert.equal(describeDbError(new AggregateError([refused], "")).kind, "unreachable");
});

test("the not-configured message is shared with the store", () => {
  assert.equal(describeDbError(new Error(MISSING_DATABASE_URL_MESSAGE)).kind, "not_configured");
});
