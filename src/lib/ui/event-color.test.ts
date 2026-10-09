import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENT_COLORS, eventColor } from "./event-color.ts";

test("the same id always gets the same colour", () => {
  assert.equal(eventColor("abc123"), eventColor("abc123"));
});

test("colours come from the palette and all three get used across many ids", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const c = eventColor(`event-${i}`);
    assert.ok(EVENT_COLORS.includes(c));
    seen.add(c);
  }
  assert.equal(seen.size, 3);
});

test("an empty id still returns a valid colour", () => {
  assert.ok(EVENT_COLORS.includes(eventColor("")));
});
