import { motion } from "framer-motion";
import { Mail, HardDrive, type LucideIcon } from "lucide-react";

export type Source = {
  tool: "search_gmail" | "search_drive";
  title: string;
  slug: string;
  score: number;
  url?: string;
};

const ICON: Record<Source["tool"], LucideIcon> = {
  search_gmail: Mail,
  search_drive: HardDrive,
};

const BASE_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] " +
  "bg-[var(--bg-panel-raised)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] " +
  "transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]";

export function SourceChip({ source }: { source: Source }) {
  const label = source.title || source.slug;
  const Icon = ICON[source.tool];
  const content = (
    <>
      <Icon size={14} aria-hidden />
      <span className="max-w-[240px] truncate">{label}</span>
    </>
  );

  if (!source.url) {
    return (
      <span className={BASE_CLASSES} title={`relevance ${source.score.toFixed(2)}`}>
        {content}
      </span>
    );
  }

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`relevance ${source.score.toFixed(2)} — open source`}
      className={BASE_CLASSES}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      {content}
    </motion.a>
  );
}
