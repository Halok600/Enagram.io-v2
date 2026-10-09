import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { APPROVAL_GATED_TOOLS, TOOL_APPROVAL_POLICY } from "./approval.ts";

/**
 * Every tool the chat can call must be either approval-gated or explicitly listed here as
 * safe without a click. A NEW tool is in neither, so this test fails until someone decides.
 * (Fail-closed: add a write tool and forget the policy -> red.)
 */
const READ_ONLY_OR_DRAFT_ONLY = [
  "search_gmail",
  "search_drive",
  "search_calendar",
  "find_related",
  // Only creates a Gmail DRAFT that the owner reviews and sends in Gmail; it can never send.
  "draft_gmail_reply",
];

// tools.ts and what it imports use the "@/" alias and extensionless relative imports (Next.js
// resolves those, plain Node does not). This hook, active for this test file's process only,
// resolves both so the REAL tool registry can be loaded and inspected.
register(
  "data:text/javascript," +
    encodeURIComponent(`
      import { existsSync } from "node:fs";
      const root = ${JSON.stringify(new URL("../../", import.meta.url).href)};
      function withExtension(url) {
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(new URL(url + ext))) return url + ext;
        }
        return undefined;
      }
      export async function resolve(specifier, context, next) {
        let target;
        if (specifier.startsWith("@/")) target = new URL(specifier.slice(2), root).href;
        else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL)
          target = new URL(specifier, context.parentURL).href;
        if (target && !/[.][a-z]+$/.test(target)) {
          const resolved = withExtension(target);
          if (resolved) return next(resolved, context);
        } else if (target) {
          return next(target, context);
        }
        return next(specifier, context);
      }
    `),
);

test("every tool createBrainTools registers is gated or explicitly allowed as read-only/draft-only", async () => {
  const { createBrainTools } = await import("./tools.ts");
  // With an access token, so the calendar and Gmail-draft tools are included too.
  const registered = Object.keys(createBrainTools("test-token", "owner@example.com"));

  for (const name of registered) {
    const gated = name in TOOL_APPROVAL_POLICY;
    const allowed = READ_ONLY_OR_DRAFT_ONLY.includes(name);
    assert.ok(gated || allowed, `tool "${name}" is neither approval-gated nor on the read-only allowlist`);
    assert.ok(!(gated && allowed), `tool "${name}" is on both lists`);
  }
  for (const name of APPROVAL_GATED_TOOLS) {
    assert.ok(registered.includes(name), `gated tool "${name}" is not registered any more`);
  }
  for (const name of READ_ONLY_OR_DRAFT_ONLY) {
    assert.ok(registered.includes(name), `allowlisted tool "${name}" is not registered any more`);
  }
});
