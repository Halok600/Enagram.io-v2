import { motion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import { Brain, User } from "lucide-react";
import { SourceChip, type Source } from "./SourceChip";
import { ThinkingIndicator } from "./ThinkingIndicator";

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--accent)] underline decoration-1 underline-offset-2 transition-colors hover:text-[var(--accent-strong)]"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-none space-y-1.5 pl-0">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-2 pl-0 before:mt-2.5 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-[var(--text-tertiary)] before:content-['']">
      <span>{children}</span>
    </li>
  ),
  code: ({ children }) => (
    <code className="rounded-[var(--radius-sm)] bg-[var(--bg-panel-raised)] px-1.5 py-0.5 font-mono text-sm text-[var(--accent)]">
      {children}
    </code>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
};

type Role = "user" | "assistant";

function formatTime(timestamp?: number): string {
  if (!timestamp) return "--:--";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ isUser }: { isUser: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        isUser ? "bg-[var(--bg-panel-raised)]" : "bg-[var(--accent-soft-bg)]"
      }`}
    >
      {isUser ? (
        <User size={16} className="text-[var(--text-secondary)]" />
      ) : (
        <Brain size={16} className="text-[var(--accent)]" />
      )}
    </div>
  );
}

export function MessageBubble({
  role,
  text,
  sources,
  pending,
  timestamp,
}: {
  role: Role;
  text: string;
  sources: Source[];
  pending: boolean;
  timestamp?: number;
}) {
  const isUser = role === "user";

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex max-w-[68ch] items-start gap-2.5 ${isUser ? "self-end flex-row-reverse" : "self-start"}`}
    >
      <Avatar isUser={isUser} />

      <div className={`flex min-w-0 flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        <span className="text-xs font-medium text-[var(--text-tertiary)]">
          {isUser ? "You" : "Brain"} · {formatTime(timestamp)}
        </span>

        <div
          className={`rounded-[var(--radius-lg)] px-6 py-4 text-base leading-relaxed ${
            isUser
              ? "bg-[var(--accent-soft-bg)] text-[var(--text-primary)]"
              : "border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-primary)]"
          }`}
        >
          {text ? (
            <div>
              <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
            </div>
          ) : pending ? (
            <ThinkingIndicator />
          ) : null}

          {!isUser && sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
              {sources.map((s) => (
                <SourceChip key={s.slug} source={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
