import type { GmailMessage } from "@/lib/google/gmail";
import type { DriveFile } from "@/lib/google/drive";
import type { CalendarEvent } from "@/lib/google/calendar";
import type { BrainDocument } from "./types";

function extractEmailAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim().toLowerCase();
}

export function gmailMessageToBrainDocument(message: GmailMessage): BrainDocument {
  const participants = [message.from, ...message.to, ...message.cc]
    .filter(Boolean)
    .map(extractEmailAddress);

  return {
    id: `gmail:${message.id}`,
    source: "gmail",
    title: message.subject || "(no subject)",
    body: message.body || message.snippet,
    participants: Array.from(new Set(participants)),
    attachments: message.attachments.map((a) => ({ name: a.filename })),
    timestamp: message.date,
    url: `https://mail.google.com/mail/u/0/#all/${message.threadId}`,
    raw: message,
  };
}

function formatEventTimeRange(start: string, end: string): string {
  // All-day events come through as bare "YYYY-MM-DD" (no time component);
  // timed events as full ISO 8601 — only try to format the latter as a
  // localized time, otherwise just show the date as-is.
  const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(start);
  if (isAllDay) return `${start} (all day)`;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
}

export function calendarEventToBrainDocument(event: CalendarEvent): BrainDocument {
  const participants = [event.organizer, ...event.attendees].filter(Boolean).map((a) => a.toLowerCase());

  // Restated as body text (not just frontmatter) for the same reason
  // participants are in gmailMessageToBrainDocument below — gbrain only
  // indexes/returns body text to search, never frontmatter.
  const body = [
    `When: ${formatEventTimeRange(event.start, event.end)}`,
    event.location ? `Location: ${event.location}` : null,
    event.description || null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    id: `calendar:${event.id}`,
    source: "calendar",
    title: event.summary,
    body,
    participants: Array.from(new Set(participants)),
    attachments: [],
    timestamp: event.start,
    url: event.htmlLink,
    raw: event,
  };
}

export function driveFileToBrainDocument(file: DriveFile): BrainDocument {
  return {
    id: `drive:${file.id}`,
    source: "drive",
    title: file.name || "(untitled)",
    body: file.content,
    participants: file.owners.map((o) => o.toLowerCase()),
    attachments: [{ name: file.name, driveFileId: file.id }],
    timestamp: file.modifiedTime,
    url: file.webViewLink,
    raw: file,
  };
}
