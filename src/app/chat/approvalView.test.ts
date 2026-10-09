import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectEventTitles,
  describeAction,
  getApprovalCards,
  hasAwaitingApproval,
  isToolPartInFlight,
} from "./approvalView.ts";

// --- describeAction: tool name + input -> plain-language sentence ---------------------------

test("save_preference names the exact text that will be saved", () => {
  assert.equal(
    describeAction("save_preference", { fact: "Prefers short replies" }),
    'Save preference: "Prefers short replies"',
  );
});

test("forget_preference names the text that will be removed", () => {
  assert.equal(
    describeAction("forget_preference", { fact: "short replies" }),
    'Forget preference matching: "short replies"',
  );
});

test("create_calendar_event shows title and times, plus the location when there is one", () => {
  assert.equal(
    describeAction("create_calendar_event", {
      summary: "Planning call",
      startDateTime: "2026-08-17T14:30:00+05:30",
      endDateTime: "2026-08-17T15:00:00+05:30",
    }),
    'Create event "Planning call", 2026-08-17 14:30+05:30 to 2026-08-17 15:00+05:30',
  );
  assert.match(
    describeAction("create_calendar_event", {
      summary: "Lunch",
      startDateTime: "2026-08-17T12:00:00Z",
      endDateTime: "2026-08-17T13:00:00Z",
      location: "Cafe",
    }),
    /, at Cafe$/,
  );
});

test("update_calendar_event lists only the fields that change", () => {
  assert.equal(
    describeAction(
      "update_calendar_event",
      { eventId: "evt1", startDateTime: "2026-08-18T09:00:00Z", location: "Room 4" },
      "Planning call",
    ),
    'Update calendar event "Planning call": start to 2026-08-18 09:00Z, location to "Room 4"',
  );
});

test("delete_calendar_event names the event by title when known, else by id", () => {
  assert.equal(
    describeAction("delete_calendar_event", { eventId: "evt1" }, "Planning call"),
    'Delete calendar event "Planning call"?',
  );
  assert.equal(describeAction("delete_calendar_event", { eventId: "evt1" }), "Delete calendar event evt1?");
});

test("missing, wrong-typed or hostile input still gives a sentence and never throws", () => {
  for (const input of [undefined, null, "oops", 42, [], {}, { fact: 7 }, { eventId: {} }]) {
    for (const name of [
      "save_preference",
      "forget_preference",
      "create_calendar_event",
      "update_calendar_event",
      "delete_calendar_event",
    ]) {
      const sentence = describeAction(name, input);
      assert.equal(typeof sentence, "string");
      assert.ok(sentence.length > 0, `${name} with ${JSON.stringify(input)}`);
    }
  }
  assert.equal(describeAction("save_preference", {}), "Save a preference (no text given)");
  assert.equal(describeAction("delete_calendar_event", {}), "Delete a calendar event (no event given)");
});

test("very long text is shortened so the card stays readable", () => {
  const sentence = describeAction("save_preference", { fact: "x".repeat(2000) });
  assert.ok(sentence.length < 400);
  assert.ok(sentence.includes("…"));
});

test("an unknown tool gets a generic sentence", () => {
  assert.equal(describeAction("something_else", {}), "Run something_else");
});

// --- getApprovalCards / hasAwaitingApproval ---------------------------------------------------

const requested = (toolName: string, id: string, extra: object = {}) => ({
  type: `tool-${toolName}`,
  toolCallId: `call-${id}`,
  state: "approval-requested",
  input: { fact: "Prefers short replies" },
  approval: { id },
  ...extra,
});

test("a part in state approval-requested is awaiting approval", () => {
  const cards = getApprovalCards([requested("save_preference", "a1")]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].status, "pending");
  assert.equal(cards[0].approvalId, "a1");
  assert.equal(cards[0].toolName, "save_preference");
  assert.equal(cards[0].sentence, 'Save preference: "Prefers short replies"');
});

test("automatic approvals are not awaiting the owner", () => {
  const parts = [requested("save_preference", "a1", { approval: { id: "a1", isAutomatic: true } })];
  assert.deepEqual(getApprovalCards(parts), []);
  assert.equal(hasAwaitingApproval([{ id: "m", role: "assistant", parts }]), false);
});

test("answered parts show their outcome and no buttons", () => {
  const approved = getApprovalCards([
    { ...requested("save_preference", "a1"), state: "approval-responded", approval: { id: "a1", approved: true } },
  ]);
  assert.equal(approved[0].status, "approved");

  const declined = getApprovalCards([
    { ...requested("save_preference", "a2"), state: "approval-responded", approval: { id: "a2", approved: false } },
  ]);
  assert.equal(declined[0].status, "declined");

  const denied = getApprovalCards([
    { ...requested("save_preference", "a3"), state: "output-denied", approval: { id: "a3", approved: false } },
  ]);
  assert.equal(denied[0].status, "declined");

  const done = getApprovalCards([
    {
      ...requested("save_preference", "a4"),
      state: "output-available",
      output: { ok: true },
      approval: { id: "a4", approved: true },
    },
  ]);
  assert.equal(done[0].status, "done");
});

test("an executed tool that reports an error, or throws, is shown as failed", () => {
  const reported = getApprovalCards([
    {
      ...requested("delete_calendar_event", "a1"),
      input: { eventId: "e1" },
      state: "output-available",
      output: { status: "error", message: "Not found" },
    },
  ]);
  assert.equal(reported[0].status, "failed");
  assert.equal(reported[0].detail, "Not found");

  const thrown = getApprovalCards([
    { ...requested("save_preference", "a2"), state: "output-error", errorText: "boom" },
  ]);
  assert.equal(thrown[0].status, "failed");
});

test("read tools, the Gmail draft tool and in-progress input never get a card", () => {
  const parts = [
    { type: "tool-search_gmail", toolCallId: "s", state: "output-available", input: {}, output: {} },
    { type: "tool-draft_gmail_reply", toolCallId: "d", state: "approval-requested", input: {}, approval: { id: "x" } },
    { type: "tool-save_preference", toolCallId: "p", state: "input-streaming", input: {} },
    { type: "tool-save_preference", toolCallId: "q", state: "input-available", input: {} },
    { type: "text", text: "hello" },
  ];
  assert.deepEqual(getApprovalCards(parts), []);
});

test("hasAwaitingApproval looks only at the last assistant message and only at unanswered parts", () => {
  const pending = { id: "a", role: "assistant", parts: [requested("save_preference", "a1")] };
  const answered = {
    id: "b",
    role: "assistant",
    parts: [{ ...requested("save_preference", "a1"), state: "approval-responded", approval: { id: "a1", approved: true } }],
  };
  const user = { id: "u", role: "user", parts: [{ type: "text", text: "hi" }] };

  assert.equal(hasAwaitingApproval([user, pending]), true);
  assert.equal(hasAwaitingApproval([user, answered]), false);
  assert.equal(hasAwaitingApproval([user]), false);
  assert.equal(hasAwaitingApproval([]), false);
  // An old unanswered request followed by a newer message is no longer actionable.
  assert.equal(hasAwaitingApproval([pending, user]), false);
});

test("event titles found in earlier calendar searches label the delete and update cards", () => {
  const messages = [
    {
      id: "a",
      role: "assistant",
      parts: [
        {
          type: "tool-search_calendar",
          toolCallId: "s",
          state: "output-available",
          output: { results: [{ eventId: "evt1", title: "Planning call" }, { title: "no id" }, null] },
        },
      ],
    },
  ];
  const titles = collectEventTitles(messages);
  assert.equal(titles.get("evt1"), "Planning call");
  assert.equal(titles.size, 1);

  const cards = getApprovalCards(
    [{ ...requested("delete_calendar_event", "a1"), input: { eventId: "evt1" } }],
    titles,
  );
  assert.equal(cards[0].sentence, 'Delete calendar event "Planning call"?');
});

// --- the sidebar's "tools running" indicator --------------------------------------------------

test("a tool waiting for the owner, or already denied, is not counted as running", () => {
  assert.equal(isToolPartInFlight("input-streaming"), true);
  assert.equal(isToolPartInFlight("input-available"), true);
  assert.equal(isToolPartInFlight("approval-responded"), true);
  assert.equal(isToolPartInFlight(undefined), true);
  assert.equal(isToolPartInFlight("approval-requested"), false);
  assert.equal(isToolPartInFlight("output-available"), false);
  assert.equal(isToolPartInFlight("output-error"), false);
  assert.equal(isToolPartInFlight("output-denied"), false);
});
