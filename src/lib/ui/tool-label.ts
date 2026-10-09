const LABELS: Record<string, string> = {
  search_gmail: "SEARCHING GMAIL",
  search_drive: "SEARCHING DRIVE",
  search_calendar: "CHECKING CALENDAR",
  draft_gmail_reply: "DRAFTING A REPLY",
  save_preference: "SAVING A PREFERENCE",
  forget_preference: "FORGETTING A PREFERENCE",
  find_related: "FINDING RELATED ITEMS",
  create_calendar_event: "CREATING AN EVENT",
  update_calendar_event: "UPDATING AN EVENT",
  delete_calendar_event: "DELETING AN EVENT",
};

export function toolLabel(name: string): string {
  return Object.hasOwn(LABELS, name) ? LABELS[name] : "WORKING";
}

export function tickerText(names: readonly string[]): string {
  const labels = [...new Set(names.map(toolLabel))];
  return labels.length === 0 ? "THINKING" : labels.join("  •  ");
}
