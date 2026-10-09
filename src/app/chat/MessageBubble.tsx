import { motion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import { Ticket } from "../ui/Ticket";
import { Card } from "../ui/Card";
import { Stamp } from "../ui/Stamp";
import { WorkingTicker } from "../ui/WorkingTicker";
import { ApprovalCard } from "./ApprovalCard";
import type { ApprovalCardModel } from "./approvalView";
import type { Source } from "./source";

// Markdown restyled to the tokens. `onSun` swaps the accent colours that would not contrast with the
// sun-yellow user card (link and bullet colours) for the card's own text colour.
function markdownComponents(onSun: boolean): Components {
  const link = onSun ? "text-[var(--on-sun)]" : "text-[var(--link)]";
  const bullet = onSun ? "before:bg-[var(--on-sun)]" : "before:bg-[var(--cobalt)]";
  return {
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-medium underline decoration-2 underline-offset-2 hover:decoration-[3px] ${link}`}
      >
        {children}
      </a>
    ),
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    ul: ({ children }) => <ul className="my-2 list-none space-y-1.5 pl-0">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1.5 pl-6 marker:font-bold">{children}</ol>,
    li: ({ children }) => (
      <li
        className={`flex gap-2.5 pl-0 before:mt-[0.6rem] before:h-1.5 before:w-1.5 before:shrink-0 before:content-[''] [ol_&]:list-item [ol_&]:before:hidden ${bullet}`}
      >
        <span className="min-w-0">{children}</span>
      </li>
    ),
    code: ({ children }) => (
      <code className="rounded-[2px] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[0.9em] break-words text-[var(--ink)] [pre_&]:border-0 [pre_&]:bg-transparent [pre_&]:p-0">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-3 overflow-x-auto rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] p-3 text-sm text-[var(--ink)]">
        {children}
      </pre>
    ),
    h1: ({ children }) => <h3 className="mt-4 mb-2 text-xl font-bold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-bold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-bold first:mt-0">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-[var(--line)] pl-3 italic">{children}</blockquote>
    ),
    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  };
}

const ANSWER_MARKDOWN = markdownComponents(false);
const USER_MARKDOWN = markdownComponents(true);

type Role = "user" | "assistant";

function formatTime(timestamp?: number): string {
  if (!timestamp) return "--:--";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// The speech-bubble tail: a square turned 45deg whose top and left edges form the outlined point, sitting on the
// card's top edge. It is filled with the card colour so it cuts the card's own outline cleanly.
function Tail({ className, fill }: { className: string; fill: string }) {
  return (
    <span
      aria-hidden
      className={`absolute -top-[8.25px] h-3.5 w-3.5 rotate-45 border-t-[length:var(--stroke)] border-l-[length:var(--stroke)] border-[var(--line)] ${fill} ${className}`}
    />
  );
}

export function MessageBubble({
  role,
  text,
  sources,
  approvals = [],
  onApprovalResponse,
  pending,
  timestamp,
  activeTools,
}: {
  role: Role;
  text: string;
  sources: Source[];
  approvals?: ApprovalCardModel[];
  onApprovalResponse?: (approvalId: string, approved: boolean) => void;
  pending: boolean;
  timestamp?: number;
  /** Names of the tool calls running right now (shown by the working ticker while the answer is still empty). */
  activeTools?: readonly string[];
}) {
  const isUser = role === "user";
  const isWorking = !text && pending && approvals.length === 0;
  const showApprovals = !isUser && onApprovalResponse && approvals.length > 0;
  // The ticker and the approval card need room, so those messages take the full column width.
  const wide = !isUser && (isWorking || showApprovals);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex max-w-[68ch] min-w-0 flex-col gap-3 ${wide ? "w-full" : ""} ${isUser ? "items-end self-end" : "items-start self-start"}`}
    >
      <div className="flex items-center gap-2.5 px-1">
        {isUser ? (
          <span className="font-display text-xs tracking-wide">YOU · {formatTime(timestamp)}</span>
        ) : (
          <>
            <Stamp tone="cobalt">BRAIN</Stamp>
            <span className="font-display text-xs tracking-wide text-[var(--ink-soft)]">{formatTime(timestamp)}</span>
          </>
        )}
      </div>

      {text ? (
        <Card
          tone={isUser ? "sun" : "panel"}
          className="relative max-w-full px-5 py-4 text-base leading-[1.55] break-words"
        >
          <Tail fill={isUser ? "bg-[var(--sun)]" : "bg-[var(--panel)]"} className={isUser ? "right-6" : "left-5"} />
          <ReactMarkdown components={isUser ? USER_MARKDOWN : ANSWER_MARKDOWN}>{text}</ReactMarkdown>
        </Card>
      ) : isWorking ? (
        <div className="w-full">
          <WorkingTicker names={activeTools ?? []} />
        </div>
      ) : null}

      {showApprovals &&
        approvals.map((card) => <ApprovalCard key={card.toolCallId} card={card} onRespond={onApprovalResponse} />)}

      {!isUser && sources.length > 0 && (
        <div className="flex w-full flex-wrap gap-x-4 gap-y-5 pt-1">
          {sources.map((s, i) => (
            <div key={s.slug} className="w-full sm:w-[22rem]">
              <Ticket
                n={i + 1}
                title={s.title || s.slug}
                tone={s.tool === "search_gmail" ? "cobalt" : "sun"}
                url={s.url}
                score={s.score}
              />
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
