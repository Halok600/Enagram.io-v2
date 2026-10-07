"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import type { UIMessage, ChatStatus } from "ai";
import { MessageBubble } from "./MessageBubble";
import { SystemErrorBanner } from "./SystemErrorBanner";
import { EmptyState } from "./EmptyState";
import { extractSources } from "./extractSources";

export function Chat({
  name,
  messages,
  status,
  userTimestamps,
  assistantTimestamps,
  onSend,
  systemError,
  onRetry,
}: {
  name?: string;
  messages: UIMessage[];
  status: ChatStatus;
  userTimestamps: number[];
  assistantTimestamps: Record<string, number>;
  onSend: (text: string) => void;
  systemError: string | null;
  onRetry: () => void;
}) {
  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0 && !systemError;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    onSend(input);
    setInput("");
  }

  return (
    <div className={`flex h-full flex-1 flex-col gap-5 ${isEmpty ? "justify-center" : ""}`}>
      {isEmpty ? (
        <EmptyState name={name} onSend={onSend} isBusy={isBusy} />
      ) : (
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] p-8">
          {(() => {
            const userMessageIds = messages.filter((m) => m.role === "user").map((m) => m.id);

            return messages.map((message) => {
              const isUser = message.role === "user";
              const text = message.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");

              // A failed generation can leave a real-but-empty assistant
              // message in the transcript (the request errored before any
              // tokens arrived). Once we're no longer busy, an empty bubble
              // with nothing in it is just visual noise — the error banner
              // below explains what happened instead.
              if (!isUser && !text && !isBusy) return null;

              return (
                <MessageBubble
                  key={message.id}
                  role={isUser ? "user" : "assistant"}
                  text={text}
                  sources={extractSources(message.parts)}
                  pending={isBusy}
                  timestamp={
                    isUser
                      ? userTimestamps[userMessageIds.indexOf(message.id)]
                      : assistantTimestamps[message.id]
                  }
                />
              );
            });
          })()}

          {systemError && <SystemErrorBanner message={systemError} onRetry={onRetry} />}
        </div>
      )}

      <motion.form
        layout
        onSubmit={handleSubmit}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`flex items-center gap-3 ${isEmpty ? "mx-auto w-full max-w-2xl" : ""}`}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your brain..."
          disabled={isBusy}
          className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] px-5 py-4 text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] disabled:opacity-50"
        />
        <motion.button
          type="submit"
          disabled={isBusy || !input.trim()}
          whileHover={isBusy || !input.trim() ? undefined : { y: -1, boxShadow: "var(--shadow-md)" }}
          whileTap={isBusy || !input.trim() ? undefined : { scale: 0.96 }}
          transition={{ duration: 0.15 }}
          aria-label="Send"
          className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-strong)] text-white disabled:opacity-40 disabled:hover:shadow-none"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <ArrowUp size={22} />
        </motion.button>
      </motion.form>
    </div>
  );
}
