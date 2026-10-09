import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type Props = {
  as?: "div" | "section" | "article";
  shadow?: "none" | "sm" | "md" | "lg";
  tone?: "panel" | "sun" | "cobalt" | "bubblegum";
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

const SHADOW: Record<NonNullable<Props["shadow"]>, string> = {
  none: "0 0 #0000",
  sm: "var(--shadow-hard-sm)",
  md: "var(--shadow-hard)",
  lg: "var(--shadow-hard-lg)",
};

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  panel: "bg-[var(--panel)] text-[var(--ink)]",
  sun: "bg-[var(--sun)] text-[var(--on-sun)]",
  cobalt: "bg-[var(--cobalt)] text-[var(--on-cobalt)]",
  bubblegum: "bg-[var(--bubblegum)] text-[var(--on-bubblegum)]",
};

// A flat panel: 2.5px outline, 4px radius, hard shadow. Never rotates (it carries text to be read).
export function Card({ as: Tag = "div", shadow = "md", tone = "panel", className = "", style, children, ...rest }: Props) {
  const merged = { "--elevation": SHADOW[shadow], ...style } as CSSProperties;
  return (
    <Tag
      style={merged}
      className={`elev rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] ${TONE[tone]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
