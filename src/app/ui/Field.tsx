import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type Props = { label: string; id: string; multiline?: boolean } & (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement>);

const FIELD =
  "elev block w-full rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 text-base text-[var(--ink)] placeholder:text-[var(--ink-soft)] [--elevation:var(--shadow-hard-sm)]";

// Label + thick-outlined input or textarea. The global :focus-visible rule adds the ink outline and the
// yellow ring on top of the field's own shadow (via --elevation).
export function Field({ label, id, multiline = false, className = "", ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} rows={4} className={`${FIELD} resize-y ${className}`} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input id={id} className={`${FIELD} min-h-11 ${className}`} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}
