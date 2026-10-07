import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

export function SystemErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex max-w-[68ch] flex-col gap-3 self-start rounded-[var(--radius-lg)] border border-[var(--danger)]/30 bg-[var(--danger-soft-bg)] px-6 py-4"
    >
      <span className="text-sm font-medium leading-relaxed text-[var(--danger)]">{message}</span>
      <motion.button
        type="button"
        onClick={onRetry}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        className="inline-flex w-fit items-center gap-1.5 self-start rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)]"
      >
        <RotateCcw size={13} />
        Retry
      </motion.button>
    </motion.div>
  );
}
