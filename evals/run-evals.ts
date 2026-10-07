/**
 * Real eval loop for the Enagram.io assignment (harness-engineering
 * bonus, SPEC.md §5). Runs the actual production tool set and system
 * prompt (shared via src/lib/query/config.ts — not a hand-copied duplicate)
 * against real live data (the deployed gbrain brain over the remote MCP
 * server), so a pass here means the real system behaves correctly, not a
 * mock. Run with: `npm run eval` (or `bun run evals/run-evals.ts`).
 *
 * Each case checks two independent things:
 *   - toolsPass: were the expected search tools actually invoked (proof of
 *     single- vs cross-source retrieval, not just a plausible-sounding text)
 *   - contentPass: does the final answer contain the expected keywords, or
 *     (for grounding cases) correctly say "not found" instead of fabricating
 */
import { google } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { searchGmailTool, searchDriveTool, searchCalendarTool } from "@/lib/query/tools";
import { CHAT_MODEL_ID, getSystemPrompt } from "@/lib/query/config";
import { EVAL_CASES, type EvalCase } from "./cases";

const NOT_FOUND_PATTERN =
  /couldn't find|could not find|no (matching )?(email|record|evidence|correspondence)|don't have|no record|not found|no such|unable to find/i;

// Broader than NOT_FOUND_PATTERN on purpose: a refusal ("that's outside what
// I can help with") uses different phrasing than "I searched and found
// nothing" — matching common declining-to-answer language rather than
// absence-reporting language.
const REFUSAL_PATTERN =
  /\b(cannot|can't|can only|unable to|don't have access|no access to|outside (of )?what|not something i can)\b/i;

type CaseResult = {
  evalCase: EvalCase;
  toolsUsed: string[];
  toolsPass: boolean;
  contentPass: boolean;
  pass: boolean;
  answer: string;
  elapsedMs: number;
  error?: string;
};

async function runCase(evalCase: EvalCase): Promise<CaseResult> {
  const start = Date.now();
  try {
    const result = await generateText({
      model: google(CHAT_MODEL_ID),
      system: getSystemPrompt(),
      // Fixed read-only tool set, not createBrainTools() — evals have no
      // real user session to draft against, and should never even carry
      // the possibility of creating a live Gmail draft as a side effect.
      prompt: evalCase.query,
      tools: {
        search_gmail: searchGmailTool,
        search_drive: searchDriveTool,
        search_calendar: searchCalendarTool,
      },
      stopWhen: stepCountIs(5),
    });

    const toolsUsed = new Set<string>();
    for (const step of result.steps) {
      for (const call of step.toolCalls ?? []) {
        toolsUsed.add(call.toolName);
      }
    }

    const toolsPass = evalCase.expectedTools.every((t) => toolsUsed.has(t));

    const contentPass =
      evalCase.expectation.type === "not_found"
        ? NOT_FOUND_PATTERN.test(result.text)
        : evalCase.expectation.type === "refusal"
          ? REFUSAL_PATTERN.test(result.text)
          : evalCase.expectation.groups.every((group) =>
              group.some((kw) => result.text.toLowerCase().includes(kw.toLowerCase())),
            );

    return {
      evalCase,
      toolsUsed: Array.from(toolsUsed),
      toolsPass,
      contentPass,
      pass: toolsPass && contentPass,
      answer: result.text,
      elapsedMs: Date.now() - start,
    };
  } catch (err) {
    return {
      evalCase,
      toolsUsed: [],
      toolsPass: false,
      contentPass: false,
      pass: false,
      answer: "",
      elapsedMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function renderLog(results: CaseResult[]): string {
  const timestamp = new Date().toISOString();
  const passCount = results.filter((r) => r.pass).length;
  const lines = [
    `# Eval run — ${timestamp}`,
    "",
    `Model: \`${CHAT_MODEL_ID}\` · Cases: ${results.length} · Passed: ${passCount}/${results.length}`,
    "",
  ];

  for (const r of results) {
    lines.push(`## ${r.pass ? "PASS" : "FAIL"} — ${r.evalCase.id} (${r.evalCase.tier})`, "");
    lines.push(`**Query:** ${r.evalCase.query}`, "");
    lines.push(`**Checks:** ${r.evalCase.description}`, "");
    lines.push(
      `**Tools used:** ${r.toolsUsed.join(", ") || "(none)"} — expected [${r.evalCase.expectedTools.join(", ") || "none"}] — ${r.toolsPass ? "OK" : "MISSING"}`,
      "",
    );
    lines.push(`**Content check:** ${r.contentPass ? "OK" : "FAILED"}`, "");
    if (r.error) {
      lines.push(`**Error:** ${r.error}`, "");
    } else {
      lines.push("**Answer:**", "", "> " + r.answer.replace(/\n/g, "\n> "), "");
    }
    lines.push(`_${(r.elapsedMs / 1000).toFixed(1)}s_`, "", "---", "");
  }

  return lines.join("\n");
}

async function main() {
  console.log(`Running ${EVAL_CASES.length} eval cases against live gbrain + ${CHAT_MODEL_ID}...\n`);
  const results: CaseResult[] = [];

  for (const evalCase of EVAL_CASES) {
    process.stdout.write(`  ${evalCase.id} ... `);
    const result = await runCase(evalCase);
    results.push(result);
    console.log(result.pass ? "PASS" : "FAIL", `(${(result.elapsedMs / 1000).toFixed(1)}s)`);
  }

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n${passCount}/${results.length} passed.\n`);

  const logPath = path.join(process.cwd(), "evals", "EVAL_LOG.md");
  await writeFile(logPath, renderLog(results), "utf-8");
  console.log(`Full log written to ${logPath}`);

  if (passCount < results.length) process.exitCode = 1;
}

main();
