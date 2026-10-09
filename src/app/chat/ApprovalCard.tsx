import { motion } from "framer-motion";
import { Check, CircleAlert, ShieldQuestion, X } from "lucide-react";
import type { ApprovalCardModel, ApprovalCardStatus } from "./approvalView";

const OUTCOME_LABEL: Record<Exclude<ApprovalCardStatus, "pending">, string> = {
  approved: "Approved, working on it...",
  declined: "Declined. Nothing was changed.",
  done: "Approved and done.",
  failed: "Approved, but it did not work.",
};

/**
 * Asks the owner before a chat tool changes anything (preferences, calendar).
 * All wording comes from approvalView.ts; this only draws it. While pending it
 * shows Approve / Deny; afterwards it shows the outcome instead of buttons.
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
  const isBad = status === "failed" || status === "declined";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      role="group"
      aria-label="Confirmation needed"
      className={`mt-3 flex flex-col gap-3 rounded-[var(--radius-md)] border px-4 py-3 ${
        isPending
          ? "border-[var(--accent)]/40 bg-[var(--accent-soft-bg)]"
          : "border-[var(--border)] bg-[var(--bg-panel-raised)]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {isPending ? (
          <ShieldQuestion size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
        ) : status === "failed" ? (
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-[var(--danger)]" aria-hidden />
        ) : status === "declined" ? (
          <X size={18} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
        ) : (
          <Check size={18} className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium leading-relaxed break-words text-[var(--text-primary)]">
            {card.sentence}
          </span>
          {card.details.map((d) => (
            <div key={d.label} className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-tertiary)]">{d.label}</span>
              {/* The complete text, never clipped: scrolls when long and keeps line breaks. */}
              <div
                tabIndex={0}
                className="max-h-48 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--text-primary)]"
              >
                {d.text}
              </div>
            </div>
          ))}
          {isPending ? (
            <span className="text-xs text-[var(--text-secondary)]">Nothing happens until you choose.</span>
          ) : (
            <span className={`text-xs ${isBad ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}`}>
              {OUTCOME_LABEL[status as Exclude<ApprovalCardStatus, "pending">] ?? ""}
              {card.detail ? ` ${card.detail}` : ""}
            </span>
          )}
        </div>
      </div>

      {isPending && (
        <div className="flex gap-2 self-start">
          <motion.button
            type="button"
            onClick={() => onRespond(approvalId, true)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-strong)] px-3 py-1.5 text-xs font-medium text-white"
          >
            <Check size={13} aria-hidden />
            Approve
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onRespond(approvalId, false)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
          >
            <X size={13} aria-hidden />
            Deny
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
