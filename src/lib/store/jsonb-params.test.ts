import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// All non-test sources under src/ (SQL lives in src/lib/store; src/app is covered too).
// Test files are skipped: they run on PGlite, which is not affected.
const SRC = fileURLToPath(new URL("../..", import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

test("every $N::jsonb parameter is cast through text first ($N::text::jsonb)", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/\$\d+::jsonb/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.deepEqual(
    offenders,
    [],
    "Use $N::text::jsonb, never $N::jsonb, for a JSON string parameter. postgres.js asks the " +
      "server for the parameter type, sees jsonb, and runs JSON.stringify on our already-stringified " +
      "value, so the server gets a JSON string scalar and jsonb_to_recordset fails with 'cannot call " +
      "jsonb_to_recordset on a non-array'. Casting through text makes the driver send the string as is. " +
      "PGlite tests cannot catch this.",
  );
});
