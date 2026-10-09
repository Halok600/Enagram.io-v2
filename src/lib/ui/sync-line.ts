export function syncResultLine(r: {
  counts?: { gmail: number; drive: number; calendar: number };
  documents: number;
  changed: number;
}): string {
  const counts = r.counts ? `${r.counts.gmail} email(s) + ${r.counts.drive} file(s) + ${r.counts.calendar} event(s) → ` : "";
  const changed = r.changed > 0 ? `, ${r.changed} updated` : " (no changes)";
  return `${counts}${r.documents} document(s)${changed}.`;
}
