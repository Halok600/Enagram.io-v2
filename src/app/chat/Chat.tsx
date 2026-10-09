"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { UIMessage, ChatStatus } from "ai";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import { Card } from "../ui/Card";
import { StickerButton } from "../ui/StickerButton";
import { extractSources } from "./extractSources";
import { collectEventTitles, getApprovalCards, hasAwaitingApproval } from "./approvalView";

// One shared centred column for the transcript and the composer.
const COLUMN = "mx-auto w-full max-w-[820px]";

export function Chat({
  name,
  messages,
  status,
  userTimestamps,
  assistantTimestamps,
  activeTools,
  onSend,
  onApprovalResponse,
}: {
  name?: string;
  messages: UIMessage[];
  status: ChatStatus;
  userTimestamps: number[];
  assistantTimestamps: Record<string, number>;
  /** Tool calls running right now (for the working ticker, Task 6). */
  activeTools: readonly string[];
  onSend: (text: string) => void;
  onApprovalResponse: (approvalId: string, approved: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const reduceMotion = useReducedMotion();
  const isBusy = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;
  // A write is waiting for Approve / Deny: sending a new message now would leave it unanswered.
  const awaitingApproval = hasAwaitingApproval(messages);
  const inputLocked = isBusy || awaitingApproval;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || inputLocked) return;
    onSend(input);
    setInput("");
  }

  return (
    <div className={`flex h-full flex-1 flex-col ${isEmpty ? "gap-8 overflow-y-auto pr-2 pb-2 pl-2" : "gap-5"}`}>
      {isEmpty ? (
        <div className={`${COLUMN} mt-auto`}>
          <EmptyState name={name} onSend={onSend} isBusy={isBusy} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-4">
          <div className={`${COLUMN} flex flex-col gap-7`}>
          {(() => {
            const userMessageIds = messages.filter((m) => m.role === "user").map((m) => m.id);
            const eventTitles = collectEventTitles(messages);

            return messages.map((message) => {
              const isUser = message.role === "user";
              const text = message.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");

              // A failed generation can leave a real-but-empty assistant
              // message in the transcript (the request errored before any
              // tokens arrived). Once we're no longer busy, an empty bubble
              // with nothing in it is just visual noise — the tape strip
              // above explains what happened instead.
              const approvals = isUser ? [] : getApprovalCards(message.parts, eventTitles);
              if (!isUser && !text && !isBusy && approvals.length === 0) return null;

              return (
                <MessageBubble
                  key={message.id}
                  role={isUser ? "user" : "assistant"}
                  text={text}
                  sources={extractSources(message.parts)}
                  approvals={approvals}
                  onApprovalResponse={onApprovalResponse}
                  pending={isBusy}
                  activeTools={activeTools}
                  timestamp={
                    isUser
                      ? userTimestamps[userMessageIds.indexOf(message.id)]
                      : assistantTimestamps[message.id]
                  }
                />
              );
            });
          })()}
          </div>
        </div>
      )}

      <motion.form
        layout
        onSubmit={handleSubmit}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
        className={`mx-auto w-full shrink-0 ${isEmpty ? "mb-auto max-w-[820px]" : "max-w-[836px] px-2"}`}
      >
        <Card shadow="lg" className="flex items-center gap-3 p-2.5">
          <input
            aria-label="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={awaitingApproval ? "Approve or deny the action above to continue" : "Ask your brain..."}
            disabled={inputLocked}
            className="min-h-14 min-w-0 flex-1 rounded-[var(--radius-card)] bg-[var(--panel)] px-3 text-lg text-[var(--ink)] placeholder:text-[var(--ink-soft)] disabled:opacity-60"
          />
          <StickerButton type="submit" tone="cobalt" size="lg" disabled={inputLocked || !input.trim()} aria-label="Send">
            GO!
          </StickerButton>
        </Card>
      </motion.form>
    </div>
  );
}
