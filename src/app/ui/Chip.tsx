"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { THUNK, TONE_CLASS } from "./tone";

// An in-app route (starts with "/") goes through next/link so navigation stays client-side.
const MotionLink = motion.create(Link);

type Props = {
  tone?: "cobalt" | "sun" | "bubblegum" | "plain";
  href?: string;
  /** Opens in a new tab with the standard noopener noreferrer pairing (for links to other sites). */
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

// A pill sticker. Renders an <a> with href, a <button> with onClick, otherwise a plain label.
// Interactive chips get an invisible pseudo-element that stretches the hit area to 44px.
export function Chip({ tone = "plain", href, external, onClick, disabled, icon, children, className = "" }: Props) {
  const reduce = useReducedMotion();
  const interactive = !disabled && (href !== undefined || onClick !== undefined);
  const base = `inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border-[length:var(--stroke)] border-[var(--line)] px-3.5 text-sm leading-none font-bold whitespace-nowrap ${TONE_CLASS[tone]} ${className}`;
  const press = interactive ? "pressable relative cursor-pointer before:absolute before:-inset-y-[7px] before:inset-x-0 before:content-['']" : "elev [--elevation:var(--shadow-hard-sm)]";
  const off = disabled ? "opacity-45 cursor-not-allowed" : "";
  const motionProps = {
    whileHover: !disabled && !reduce ? { rotate: -1, x: interactive ? -1 : 0, y: interactive ? -1 : 0 } : undefined,
    whileTap: interactive && !reduce ? { x: 2, y: 2 } : undefined,
    transition: THUNK,
  };
  const body = (
    <>
      {icon ? <span aria-hidden className="inline-flex shrink-0">{icon}</span> : null}
      {children}
      {external && href !== undefined && !disabled ? <span className="sr-only">(opens in a new tab)</span> : null}
    </>
  );
  const cls = `${base} ${press} ${off}`;
  if (href !== undefined && !disabled) {
    if (external) {
      return <motion.a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...motionProps}>{body}</motion.a>;
    }
    if (href.startsWith("/")) return <MotionLink href={href} className={cls} {...motionProps}>{body}</MotionLink>;
    return <motion.a href={href} className={cls} {...motionProps}>{body}</motion.a>;
  }
  if (onClick !== undefined || disabled) {
    return <motion.button type="button" disabled={disabled} onClick={onClick} className={cls} {...motionProps}>{body}</motion.button>;
  }
  return <motion.span className={cls} {...motionProps}>{body}</motion.span>;
}
