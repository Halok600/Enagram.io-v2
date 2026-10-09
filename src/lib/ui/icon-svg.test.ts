import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

// The favicon (src/app/icon.svg) is served as-is to every browser tab: it must stay a small, self-contained drawing.
const url = new URL("../../app/icon.svg", import.meta.url);
const svg = readFileSync(url, "utf8");

test("icon.svg is a single small SVG with a viewBox", () => {
  assert.match(svg, /^<svg [^>]*viewBox="0 0 64 64"/);
  assert.ok(statSync(url).size < 3 * 1024, `icon.svg is ${statSync(url).size} bytes, the limit is 3 KB`);
});

test("icon.svg has no script and no external references", () => {
  assert.doesNotMatch(svg, /<script/i);
  assert.doesNotMatch(svg, /href=/i);
  assert.doesNotMatch(svg, /url\(http/i);
});

test("icon.svg uses only the light-theme token colours", () => {
  const colours = new Set(svg.match(/#[0-9a-f]{6}\b/gi)?.map((c) => c.toLowerCase()));
  assert.deepEqual([...colours].sort(), ["#111111", "#2a3bff", "#ffd23f", "#ffffff"]);
});
