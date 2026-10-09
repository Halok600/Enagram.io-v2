import { test } from "node:test";
import assert from "node:assert/strict";
import { isHttpUrl } from "./safe-url.ts";

test("http and https URLs are links", () => {
  assert.equal(isHttpUrl("https://mail.google.com/x"), true);
  assert.equal(isHttpUrl("http://example.com"), true);
  assert.equal(isHttpUrl("HTTPS://EXAMPLE.COM"), true);
});

test("other schemes, relative paths and junk are not links", () => {
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("data:text/html,x"), false);
  assert.equal(isHttpUrl("//evil.example"), false);
  assert.equal(isHttpUrl("/relative"), false);
  assert.equal(isHttpUrl(" https://leading-space.example"), false);
  assert.equal(isHttpUrl(""), false);
  assert.equal(isHttpUrl(undefined), false);
  assert.equal(isHttpUrl(null), false);
});
