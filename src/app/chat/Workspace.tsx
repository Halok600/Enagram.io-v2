"use client";

import { useEffect, useRef, useState } from "react";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { Sidebar } from "./Sidebar";
import { Chat } from "./Chat";
import { runFullSync } from "../syncClient";
import { DbStatusBanner } from "./DbStatusBanner";
import { friendlyClientError } from "@/lib/client-errors";
import { isToolPartInFlight } from "./approvalView";

const TOOL_TYPES = [
  "tool-search_gmail",
  "tool-search_drive",
  "tool-search_calendar",
  "tool-draft_gmail_reply",
  "tool-save_preference",
  "tool-forget_preference",
  "tool-find_related",
  "tool-create_calendar_event",
  "tool-update_calendar_event",
  "tool-delete_calendar_event",
] as const;

const TOOL_NAME_BY_PART_TYPE: Record<(typeof TOOL_TYPES)[number], string> = {
  "tool-search_gmail": "search_gmail",
  "tool-search_drive": "search_drive",
  "tool-search_calendar": "search_calendar",
  "tool-draft_gmail_reply": "draft_gmail_reply",
  "tool-save_preference": "save_preference",
  "tool-forget_preference": "forget_preference",
  "tool-find_related": "find_related",
  "tool-create_calendar_event": "create_calendar_event",
  "tool-update_calendar_event": "update_calendar_event",
  "tool-delete_calendar_event": "delete_calendar_event",
};

/** Tool calls in-flight on the current (last) message — not yet output-available/output-error. */
function computeActiveTools(messages: UIMessage[]): string[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return [];

  const active = new Set<string>();
  for (const part of last.parts) {
    if (!(TOOL_TYPES as readonly string[]).includes(part.type)) continue;
    const state = (part as { state?: string }).state;
    // Waiting on the owner's Approve/Deny, or already finished/denied: not "running".
    if (!isToolPartInFlight(state)) continue;
    active.add(TOOL_NAME_BY_PART_TYPE[part.type as (typeof TOOL_TYPES)[number]]);
  }
  return Array.from(active);
}

export function Workspace({ email, name }: { email: string; name?: string }) {
  // useChat's sendMessage({ messageId }) REPLACES an existing message with
  // that id — it doesn't let you assign an id to a new one — so a real id
  // for the user's own message isn't knowable until the hook creates it.
  // Simplest correct fix: stamp by POSITION instead of id. Each user
  // message gets the next entry in this array, in send order; Chat.tsx
  // looks it up by counting user messages as it renders them.
  const [userTimestamps, setUserTimestamps] = useState<number[]>([]);
  const [assistantTimestamps, setAssistantTimestamps] = useState<Record<string, number>>({});
  const [systemError, setSystemError] = useState<string | null>(null);

  const chat: UseChatHelpers<UIMessage> = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    // Once every pending write in the last step has an Approve/Deny answer, send the
    // conversation back so the server runs (or skips) the tool and the model carries on.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    // Stamps the assistant message's timestamp once it finishes streaming —
    // this DOES give us the real final id, unlike the user side above.
    onFinish: ({ message }) => {
      setAssistantTimestamps((prev) => ({ ...prev, [message.id]: Date.now() }));
    },
    // Fires for both stream-embedded errors (rate limits/overload surfaced
    // via the API route's onError, see route.ts) and network-level failures.
    // error.message is already the human-readable string the server crafted.
    onError: (error) => {
      setSystemError(friendlyClientError(error.message));
    },
  });

  const activeTools = computeActiveTools(chat.messages);

  // "Auto-sync on server startup" isn't actually reachable — Next's server
  // lifecycle has no user session/OAuth token at that point (ingestion needs
  // one). This is the practical equivalent: fire once automatically as soon
  // as an authenticated page loads, so the demo data is already fresh
  // without a manual click first. Silent/best-effort — the visible SyncButton
  // still exists for a manual re-sync, and still shows its own result.
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    // Throttled server-side: the route skips the fetch if a sync finished in the last 10 minutes
    // (AUTO_SYNC_MIN_INTERVAL_MS in lib/sync/throttle.ts). Only `auto` requests are throttled;
    // the SyncButton's manual "Sync now" always runs.
    runFullSync({ auto: true })
      .then((result) => console.log("Auto-sync on load:", result))
      .catch((err) => console.error("Auto-sync on load failed:", err));
  }, []);

  function sendStampedMessage(text: string) {
    setSystemError(null);
    setUserTimestamps((prev) => [...prev, Date.now()]);
    void chat.sendMessage({ text });
  }

  function respondToApproval(approvalId: string, approved: boolean) {
    setSystemError(null);
    void chat.addToolApprovalResponse({ id: approvalId, approved });
  }

  function retryLastMessage() {
    setSystemError(null);
    void chat.regenerate();
  }

  return (
    <div className="flex h-screen w-screen gap-4 overflow-hidden p-4">
      <Sidebar email={email} activeTools={activeTools} />
      <main className="flex min-w-0 flex-1 flex-col">
        <DbStatusBanner />
        <Chat
          name={name}
          messages={chat.messages}
          status={chat.status}
          userTimestamps={userTimestamps}
          assistantTimestamps={assistantTimestamps}
          onSend={sendStampedMessage}
          onApprovalResponse={respondToApproval}
          systemError={systemError}
          onRetry={retryLastMessage}
        />
      </main>
    </div>
  );
}
