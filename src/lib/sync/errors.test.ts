import { test } from "node:test";
import assert from "node:assert/strict";
import { GoogleFetchError, syncErrorMessage } from "./errors.ts";
import { DB_PROBLEM_MESSAGES } from "../db-errors.ts";

test("a Google timeout is reported as a Google failure, not a database timeout", () => {
  const message = syncErrorMessage(new GoogleFetchError(new Error("Gateway Timeout")));
  assert.equal(message, "Google request failed: Gateway Timeout");
  assert.notEqual(message, DB_PROBLEM_MESSAGES.timeout);
});

test("a Google network failure is not classified as an unreachable database", () => {
  const message = syncErrorMessage(new GoogleFetchError(new Error("getaddrinfo ENOTFOUND www.googleapis.com")));
  assert.equal(message, "Google request failed: getaddrinfo ENOTFOUND www.googleapis.com");
  assert.notEqual(message, DB_PROBLEM_MESSAGES.unreachable);
});

test("a paused-database error still maps to the paused message", () => {
  const err = new Error("Cannot connect to database: (ENOTFOUND) tenant/user postgres.abcdef not found.");
  assert.equal(syncErrorMessage(err), DB_PROBLEM_MESSAGES.paused);
});

test("an unknown error returns its raw message", () => {
  assert.equal(syncErrorMessage(new Error("syntax error at or near x")), "syntax error at or near x");
});

test("an unknown non-Error throwable gets the generic message", () => {
  assert.equal(syncErrorMessage({ weird: true }), "Ingestion sync failed");
});

test("GoogleFetchError accepts a non-Error cause and keeps it", () => {
  const err = new GoogleFetchError("plain string");
  assert.equal(err.message, "Google request failed: plain string");
  assert.equal(err.cause, "plain string");
  assert.equal(err.name, "GoogleFetchError");
});
