"use client";

import { useEffect, useRef, useState } from "react";
import { useChat, type UseChatHelpers } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { Chat } from "./Chat";
import { runFullSync } from "../syncClient";
import { TopBar } from "../ui/TopBar";
import { TapeSlot } from "../ui/TapeSlot";
import { useHealth } from "../useHealth";
import { useSync } from "../useSync";
import { selectTapeItems } from "@/lib/ui/tape";
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
  const health = useHealth();
  const sync = useSync();
  const tapeItems = selectTapeItems({ dbMessage: health.dbMessage, chatError: systemError, sync });

  // "Auto-sync on server startup" isn't actually reachable — Next's server
  // lifecycle has no user session/OAuth token at that point (ingestion needs
  // one). This is the practical equivalent: fire once automatically as soon
  // as an authenticated page loads, so the demo data is already fresh
  // without a manual click first. Silent/best-effort — the top bar's Sync sticker
  // is still there for a manual re-sync, and the tape strip shows its progress and result.
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    // Throttled server-side: the route skips the fetch if a sync finished in the last 10 minutes
    // (AUTO_SYNC_MIN_INTERVAL_MS in lib/sync/throttle.ts). Only `auto` requests are throttled;
    // the Sync button's manual "Sync now" always runs.
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
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <TopBar
        email={email}
        documents={health.view.documents}
        sync={{ state: sync.state, run: () => void sync.run() }}
        variant="chat"
      />
      <TapeSlot items={tapeItems} onRetry={retryLastMessage} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 pb-3 md:px-6 md:pb-5">
        {/* The empty state carries the screen's one visible h1; once a conversation starts it is gone, so this hidden
            one takes over and the page always has exactly one. */}
        {chat.messages.length > 0 ? <h1 className="sr-only">Enagram chat</h1> : null}
        <Chat
          name={name}
          messages={chat.messages}
          status={chat.status}
          userTimestamps={userTimestamps}
          assistantTimestamps={assistantTimestamps}
          activeTools={activeTools}
          onSend={sendStampedMessage}
          onApprovalResponse={respondToApproval}
        />
      </main>
    </div>
  );
}
