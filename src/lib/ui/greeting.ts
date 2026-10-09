export function firstName(name?: string): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

export const SUGGESTIONS: readonly { id: string; text: string; kind: "mail" | "calendar" | "files" | "reply" }[] = [
  { id: "mail", text: "Summarise my recent emails", kind: "mail" },
  { id: "calendar", text: "What's on my calendar this week?", kind: "calendar" },
  { id: "files", text: "Find my latest Drive files", kind: "files" },
  { id: "reply", text: "What needs a reply?", kind: "reply" },
];
