import { tool } from "ai";
import { z } from "zod";
import {
  searchGmail,
  searchDrive,
  searchCalendar,
  savePreference,
  forgetPreference,
  findRelated,
} from "@/lib/brain/gbrain-remote";
import { createDraftReply } from "@/lib/google/gmail";
import { createEvent, updateEvent, deleteEvent } from "@/lib/google/calendar";
import { friendlyGoogleErrorMessage } from "@/lib/google/friendly-error";

/**
 * The url search_gmail already returns for citations
 * (https://mail.google.com/mail/u/0/#all/<threadId>) also carries the one
 * thing draft_gmail_reply needs to target the right conversation — pull it
 * out server-side so the model just passes threadId through verbatim
 * instead of parsing a URL itself. Drive urls never match, so this is a
 * no-op (field omitted) for search_drive results.
 */
function extractGmailThreadId(url?: string): string | undefined {
  return url?.match(/#all\/([^/?]+)$/)?.[1];
}

function formatHits(hits: Awaited<ReturnType<typeof searchGmail>>) {
  if (hits.length === 0) {
    return { count: 0, results: [] };
  }
  return {
    count: hits.length,
    results: hits.map((h) => {
      const threadId = extractGmailThreadId(h.url);
      return {
        slug: h.slug,
        title: h.title,
        score: h.score,
        snippet: h.snippet,
        url: h.url,
        date: h.date,
        ...(threadId ? { threadId } : {}),
        ...(h.eventId ? { eventId: h.eventId } : {}),
      };
    }),
  };
}

export const searchGmailTool = tool({
  description:
    "Search the user's Gmail (already ingested into the brain) for emails matching a query. " +
    "Use natural-language or keyword queries, e.g. 'Stripe failed payment', 'job application status'.",
  inputSchema: z.object({
    query: z.string().describe("What to search for in the user's emails"),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, limit }) => formatHits(await searchGmail(query, limit)),
});

export const searchDriveTool = tool({
  description:
    "Search the user's Google Drive files (already ingested into the brain) for documents matching a query. " +
    "Use natural-language or keyword queries, e.g. 'contract draft', 'take-home submission'.",
  inputSchema: z.object({
    query: z.string().describe("What to search for in the user's Drive files"),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, limit }) => formatHits(await searchDrive(query, limit)),
});

export const searchCalendarTool = tool({
  description:
    "Search the user's Google Calendar (already ingested into the brain) for events matching a query. " +
    "Use natural-language or keyword queries, e.g. 'meeting with Nirmit', 'interview'. Covers roughly " +
    "the past month through the next 3 months of events.",
  inputSchema: z.object({
    query: z.string().describe("What to search for in the user's calendar events"),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, limit }) => formatHits(await searchCalendar(query, limit)),
});

export const savePreferenceTool = tool({
  description:
    "Save a fact or preference about the user for future conversations (persists across sessions). " +
    "Only call this when the user explicitly asks you to remember something (e.g. 'remember that...', " +
    "'from now on...', 'my preference is...'). Do not save facts proactively or from casual mentions.",
  inputSchema: z.object({
    fact: z
      .string()
      .describe("A clean, well-formed statement of the fact/preference to remember, written in third person"),
  }),
  execute: async ({ fact }) => savePreference(fact),
});

export const forgetPreferenceTool = tool({
  description:
    "Remove a previously saved preference/fact about the user. Only call this when the user explicitly " +
    "asks you to forget something.",
  inputSchema: z.object({
    fact: z.string().describe("The preference/fact to remove — matched against saved entries by substring"),
  }),
  execute: async ({ fact }) => forgetPreference(fact),
});

export const findRelatedTool = tool({
  description:
    "Find items linked to a specific search result across OTHER sources (e.g. a Drive file and Calendar " +
    "event linked to a Gmail thread) via gbrain's graph, built from shared participants during ingestion. " +
    "Pass the slug field from a prior search_gmail/search_drive/search_calendar result. Prefer this over a " +
    "blind re-search when you've already found one relevant item and need to check other sources for the " +
    "same real-world thread — it returns exactly what's connected instead of guessing a new query.",
  inputSchema: z.object({
    slug: z.string().describe("The slug field from a prior search result"),
  }),
  execute: async ({ slug }) => findRelated(slug),
});

function createCalendarEventTool(accessToken: string) {
  return tool({
    description:
      "Create a new event on the user's Google Calendar. Only call this when the user explicitly asks " +
      "you to schedule/create/add a calendar event. Personal events only — there is no way to invite " +
      "other people through this tool.",
    inputSchema: z.object({
      summary: z.string().describe("Event title"),
      startDateTime: z.string().describe("Start time, ISO 8601 with timezone offset, e.g. 2026-08-17T14:30:00+05:30"),
      endDateTime: z.string().describe("End time, ISO 8601 with timezone offset"),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
    execute: async ({ summary, startDateTime, endDateTime, description, location }) => {
      try {
        const event = await createEvent(accessToken, { summary, startDateTime, endDateTime, description, location });
        return { status: "created" as const, summary: event.summary, start: event.start, webLink: event.htmlLink };
      } catch (err) {
        return {
          status: "error" as const,
          message: friendlyGoogleErrorMessage(err) ?? "Failed to create the calendar event.",
        };
      }
    },
  });
}

function updateCalendarEventTool(accessToken: string) {
  return tool({
    description:
      "Update an existing Google Calendar event — only the fields you provide are changed, everything " +
      "else stays as-is. Only call this when the user explicitly asks you to change/move/update an event. " +
      "Requires the eventId field from a prior search_calendar result for that event — search for it first " +
      "if you don't already have it. If the search result doesn't carry an eventId, say you can't locate " +
      "it precisely enough to update rather than guessing.",
    inputSchema: z.object({
      eventId: z.string().describe("The eventId field from the search_calendar result for the event being changed"),
      summary: z.string().optional(),
      startDateTime: z.string().optional().describe("ISO 8601 with timezone offset"),
      endDateTime: z.string().optional().describe("ISO 8601 with timezone offset"),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
    execute: async ({ eventId, summary, startDateTime, endDateTime, description, location }) => {
      try {
        const event = await updateEvent(accessToken, {
          eventId,
          summary,
          startDateTime,
          endDateTime,
          description,
          location,
        });
        return { status: "updated" as const, summary: event.summary, start: event.start, webLink: event.htmlLink };
      } catch (err) {
        return {
          status: "error" as const,
          message: friendlyGoogleErrorMessage(err) ?? "Failed to update the calendar event.",
        };
      }
    },
  });
}

function deleteCalendarEventTool(accessToken: string) {
  return tool({
    description:
      "Permanently delete an event from the user's Google Calendar. Only call this when the user " +
      "explicitly asks you to delete/cancel/remove a specific event. Requires the eventId field from a " +
      "prior search_calendar result for that exact event — search for it first if you don't already have " +
      "it, and if you're not sure which event they mean, ask for clarification rather than guessing.",
    inputSchema: z.object({
      eventId: z.string().describe("The eventId field from the search_calendar result for the event being deleted"),
    }),
    execute: async ({ eventId }) => {
      try {
        await deleteEvent(accessToken, eventId);
        return { status: "deleted" as const, eventId };
      } catch (err) {
        return {
          status: "error" as const,
          message: friendlyGoogleErrorMessage(err) ?? "Failed to delete the calendar event.",
        };
      }
    },
  });
}

function createDraftGmailReplyTool(accessToken: string) {
  return tool({
    description:
      "Create a DRAFT reply in the user's Gmail for a specific email thread. This ONLY saves a draft " +
      "for the user to review — it can NEVER send anything. Only call this when the user explicitly asks " +
      "you to draft/write/compose a reply to a specific email. Requires the threadId field returned on " +
      "that email's search_gmail result — call search_gmail first if you don't already have it.",
    inputSchema: z.object({
      threadId: z.string().describe("The threadId field from the search_gmail result for the email being replied to"),
      body: z.string().describe("The full plain-text body of the reply to draft"),
    }),
    execute: async ({ threadId, body }) => {
      const draft = await createDraftReply(accessToken, { threadId, body });
      return {
        status: "draft_created" as const,
        to: draft.to,
        subject: draft.subject,
        webLink: draft.webLink,
      };
    },
  });
}

/**
 * A factory, not a static object: draft_gmail_reply needs the requesting
 * user's live OAuth access token (it writes to their real Gmail), unlike
 * the two search tools which go through the shared remote gbrain server
 * with its own static token. Called with no token (the eval harness has no
 * real user session) simply omits the draft tool — automated eval runs
 * should never create real Gmail drafts as a side effect.
 */
export function createBrainTools(accessToken?: string): {
  search_gmail: typeof searchGmailTool;
  search_drive: typeof searchDriveTool;
  search_calendar: typeof searchCalendarTool;
  save_preference: typeof savePreferenceTool;
  forget_preference: typeof forgetPreferenceTool;
  find_related: typeof findRelatedTool;
  draft_gmail_reply?: ReturnType<typeof createDraftGmailReplyTool>;
  create_calendar_event?: ReturnType<typeof createCalendarEventTool>;
  update_calendar_event?: ReturnType<typeof updateCalendarEventTool>;
  delete_calendar_event?: ReturnType<typeof deleteCalendarEventTool>;
} {
  return {
    search_gmail: searchGmailTool,
    search_drive: searchDriveTool,
    search_calendar: searchCalendarTool,
    save_preference: savePreferenceTool,
    forget_preference: forgetPreferenceTool,
    find_related: findRelatedTool,
    ...(accessToken
      ? {
          draft_gmail_reply: createDraftGmailReplyTool(accessToken),
          create_calendar_event: createCalendarEventTool(accessToken),
          update_calendar_event: updateCalendarEventTool(accessToken),
          delete_calendar_event: deleteCalendarEventTool(accessToken),
        }
      : {}),
  };
}
