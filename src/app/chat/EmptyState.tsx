"use client";

import { motion } from "framer-motion";
import { Mail, HardDrive, CalendarDays, Sparkles } from "lucide-react";
import { HeroLogo } from "./HeroLogo";

const SUGGESTIONS = [
  { text: "What's my status on the SkillLayer application?", icon: Sparkles },
  { text: "Summarize recent emails from Nirmit", icon: Mail },
  { text: "What Drive files do I have for internships?", icon: HardDrive },
  { text: "What's on my calendar this week?", icon: CalendarDays },
];

function firstName(name?: string): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

export function EmptyState({
  name,
  onSend,
  isBusy,
}: {
  name?: string;
  onSend: (text: string) => void;
  isBusy: boolean;
}) {
  const greetName = firstName(name);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <HeroLogo />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-2"
      >
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {greetName ? `Hello, ${greetName}` : "Hello there"}
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          What can I help you find in your brain today?
        </p>
      </motion.div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map(({ text, icon: Icon }, i) => (
          <motion.button
            key={text}
            type="button"
            disabled={isBusy}
            onClick={() => onSend(text)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.08, ease: "easeOut" }}
            whileHover={isBusy ? undefined : { y: -2, boxShadow: "var(--shadow-md)" }}
            whileTap={isBusy ? undefined : { scale: 0.98 }}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-left text-sm text-[var(--text-primary)] disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <Icon size={18} className="shrink-0 text-[var(--accent)]" />
            <span>{text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
