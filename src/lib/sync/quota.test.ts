import { test } from "node:test";
import assert from "node:assert/strict";
import { APICallError, RetryError } from "ai";
import { isQuotaError } from "./quota.ts";

function apiError(statusCode: number | undefined, message = "boom") {
  return new APICallError({ message, url: "https://example.test/embed", requestBodyValues: {}, statusCode });
}

function retry(lastError: unknown) {
  return new RetryError({ message: "Failed after 3 attempts", reason: "maxRetriesExceeded", errors: [lastError] });
}

test("a RetryError wrapping a 429 is a quota error", () => {
  assert.equal(isQuotaError(retry(apiError(429, "Too Many Requests"))), true);
});

test("a bare 429 APICallError is a quota error", () => {
  assert.equal(isQuotaError(apiError(429)), true);
});

test("the quota message is recognised even without a status code", () => {
  assert.equal(isQuotaError(retry(apiError(undefined, "You exceeded your current quota, please check your plan"))), true);
  assert.equal(isQuotaError(apiError(400, "Rate limit reached for requests")), true);
  assert.equal(isQuotaError(apiError(503, "RESOURCE_EXHAUSTED")), true);
});

test("an unrelated 500 is not a quota error", () => {
  assert.equal(isQuotaError(apiError(500, "Internal error")), false);
  assert.equal(isQuotaError(retry(apiError(500, "Internal error"))), false);
});

test("non-API errors and non-Error values are not quota errors", () => {
  assert.equal(isQuotaError(new Error("Embedding call took longer than 15000ms")), false);
  assert.equal(isQuotaError(retry(new Error("socket hang up"))), false);
  for (const v of [undefined, null, 429, "quota", { statusCode: 429 }]) assert.equal(isQuotaError(v), false);
});
