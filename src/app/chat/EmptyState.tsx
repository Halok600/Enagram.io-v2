"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, HardDrive, Mail, Reply, type LucideIcon } from "lucide-react";
import { Chip } from "../ui/Chip";
import { firstName, SUGGESTIONS } from "@/lib/ui/greeting";

const ICONS: Record<(typeof SUGGESTIONS)[number]["kind"], LucideIcon> = {
  mail: Mail,
  calendar: CalendarDays,
  files: HardDrive,
  reply: Reply,
};

// The four chips take the sticker colours in turn.
const TONES = ["cobalt", "sun", "bubblegum", "plain"] as const;

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
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, delay, ease: "easeOut" as const },
        };

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      <motion.div className="flex flex-col gap-3" {...enter(0)}>
        <h1 className="font-display text-[clamp(3rem,8vw,5.5rem)] break-words">
          WHAT&apos;S UP{greetName ? "," : "?"}
          {greetName ? <span className="block [overflow-wrap:anywhere]">{greetName}?</span> : null}
        </h1>
        <p className="font-hand text-xl text-[var(--ink-soft)] sm:text-3xl">ask me anything about your mail, files and week</p>
      </motion.div>

      <motion.ul aria-label="Suggestions" className="flex flex-wrap gap-x-3 gap-y-4" {...enter(0.12)}>
        {SUGGESTIONS.map(({ id, text, kind }, i) => {
          const Icon = ICONS[kind];
          return (
            <li key={id} className="max-w-full">
              <Chip tone={TONES[i % TONES.length]} icon={<Icon size={16} strokeWidth={2.5} />} disabled={isBusy} onClick={() => onSend(text)} className="h-auto! min-h-8 max-w-full py-1.5 text-left whitespace-normal!">
                {text}
              </Chip>
            </li>
          );
        })}
      </motion.ul>
    </div>
  );
}
