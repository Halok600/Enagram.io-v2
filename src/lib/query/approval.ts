/**
 * Which chat tools must wait for an explicit Approve click before they run.
 *
 * A pure module (no server-only imports) so the policy is unit-testable and
 * the browser side can share the list of gated names.
 *
 * Gated: every tool that WRITES (preferences, calendar). Not gated:
 * draft_gmail_reply (it only creates a draft the owner reviews in Gmail) and
 * the search/find tools (read-only).
 */
export const APPROVAL_GATED_TOOLS = [
  "save_preference",
  "forget_preference",
  "create_calendar_event",
  "update_calendar_event",
  "delete_calendar_event",
] as const;

export type ApprovalGatedTool = (typeof APPROVAL_GATED_TOOLS)[number];

/** The `toolApproval` option for streamText: each write tool waits for the owner. */
export const TOOL_APPROVAL_POLICY: Record<ApprovalGatedTool, "user-approval"> = {
  save_preference: "user-approval",
  forget_preference: "user-approval",
  create_calendar_event: "user-approval",
  update_calendar_event: "user-approval",
  delete_calendar_event: "user-approval",
};

export function isApprovalGatedTool(toolName: string): toolName is ApprovalGatedTool {
  return (APPROVAL_GATED_TOOLS as readonly string[]).includes(toolName);
}

/**
 * The value for streamText's `experimental_toolApprovalSecret`. Only a set,
 * non-blank value is used: with no secret the SDK still asks for approval,
 * it just does not sign the request (see the AI SDK "Tool Approvals" guide).
 */
export function resolveToolApprovalSecret(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
