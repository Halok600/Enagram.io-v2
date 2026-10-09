import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Stamp } from "../ui/Stamp";
import { StickerButton } from "../ui/StickerButton";
import type { Tone } from "../ui/tone";
import type { ApprovalCardModel, ApprovalCardStatus } from "./approvalView";

const OUTCOME_LABEL: Record<Exclude<ApprovalCardStatus, "pending">, string> = {
  approved: "Approved, working on it...",
  declined: "Declined. Nothing was changed.",
  done: "Approved and done.",
  failed: "Approved, but it did not work.",
};

// The stamp repeats the outcome in one word; the sentence beside it carries the full wording.
const OUTCOME_STAMP: Record<Exclude<ApprovalCardStatus, "pending">, { word: string; tone: Tone }> = {
  approved: { word: "APPROVED", tone: "cobalt" },
  declined: { word: "DECLINED", tone: "plain" },
  done: { word: "DONE", tone: "cobalt" },
  failed: { word: "FAILED", tone: "danger" },
};

/**
 * Asks the owner before a chat tool changes anything (preferences, calendar).
 * All wording comes from approvalView.ts; this only draws it. While pending it
 * shows Approve / Deny inside a hazard-striped "HOLD UP" frame; afterwards it shows
 * the outcome (a stamp and the same words) instead of buttons.
 */
export function ApprovalCard({
  card,
  onRespond,
}: {
  card: ApprovalCardModel;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const { status, approvalId } = card;
  const isPending = status === "pending" && approvalId !== undefined;
  const isFailed = status === "failed";
  const outcome = status === "pending" ? undefined : OUTCOME_STAMP[status];

  const body = (
    <Card tone={isPending ? "sun" : "panel"} shadow={isPending ? "none" : "md"} className="flex flex-col gap-3 p-4 sm:p-5">
      {isPending && <h3 className="font-display text-3xl leading-none sm:text-4xl">HOLD UP</h3>}
      <p className="text-base leading-snug font-semibold break-words">{card.sentence}</p>
      {card.details.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold">{d.label}</span>
          {/* The complete text, never clipped: scrolls when long and keeps line breaks. */}
          <Card
            shadow="none"
            tabIndex={0}
            className="max-h-48 overflow-y-auto px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap"
          >
            {d.text}
          </Card>
        </div>
      ))}

      {isPending ? (
        <>
          <p className="text-sm font-medium">Nothing happens until you choose.</p>
          <div className="grid grid-cols-2 gap-3 pt-1 sm:flex sm:flex-wrap">
            <StickerButton tone="cobalt" className="w-full sm:w-auto" onClick={() => onRespond(approvalId, true)}>
              <Check size={18} strokeWidth={3} aria-hidden />
              APPROVE
            </StickerButton>
            <StickerButton tone="danger" className="w-full sm:w-auto" onClick={() => onRespond(approvalId, false)}>
              <X size={18} strokeWidth={3} aria-hidden />
              DENY
            </StickerButton>
          </div>
        </>
      ) : (
        outcome && (
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden>
              <Stamp tone={outcome.tone}>{outcome.word}</Stamp>
            </span>
            <span className={`text-sm font-medium ${isFailed ? "text-[var(--danger-ink)]" : ""}`}>
              {OUTCOME_LABEL[status as Exclude<ApprovalCardStatus, "pending">] ?? ""}
              {card.detail ? ` ${card.detail}` : ""}
            </span>
          </div>
        )
      )}
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      role="group"
      aria-label="Confirmation needed"
      className="w-full"
    >
      {isPending ? (
        // The hazard frame: the stripes run all the way round the sun card.
        <div className="hazard elev rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] p-3 [--elevation:var(--shadow-hard)]">
          {body}
        </div>
      ) : (
        body
      )}
    </motion.div>
  );
}
