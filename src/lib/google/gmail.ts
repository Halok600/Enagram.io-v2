import { google, gmail_v1 } from "googleapis";
import { mapWithConcurrency, withBackoff } from "./rate-limit";

const GMAIL_FETCH_CONCURRENCY = 10;

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: string; // ISO 8601
  snippet: string;
  body: string; // plain text, best-effort extracted
  attachments: { filename: string; attachmentId: string; mimeType: string }[];
  labelIds: string[];
};

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(html: string): string {
  const withoutNonContent = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withoutTags = withoutNonContent.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(withoutTags).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    // Prefer text/plain; fall back to stripping tags from text/html if that's all we have.
    const plainPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data);

    for (const part of payload.parts) {
      const nested = extractPlainText(part);
      if (nested) return nested;
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return htmlToText(decodeBase64Url(htmlPart.body.data));
    }
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return htmlToText(decodeBase64Url(payload.body.data));
  }

  return "";
}

function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): GmailMessage["attachments"] {
  if (!payload) return [];
  const attachments: GmailMessage["attachments"] = [];

  function walk(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        attachmentId: part.body.attachmentId,
        mimeType: part.mimeType ?? "application/octet-stream",
      });
    }
    part.parts?.forEach(walk);
  }

  walk(payload);
  return attachments;
}

function toGmailMessage(message: gmail_v1.Schema$Message): GmailMessage {
  const headers = message.payload?.headers;
  const to = headerValue(headers, "To");
  const cc = headerValue(headers, "Cc");

  return {
    id: message.id!,
    threadId: message.threadId!,
    subject: headerValue(headers, "Subject"),
    from: headerValue(headers, "From"),
    to: to ? to.split(",").map((s) => s.trim()) : [],
    cc: cc ? cc.split(",").map((s) => s.trim()) : [],
    date: new Date(Number(message.internalDate)).toISOString(),
    snippet: message.snippet ?? "",
    body: extractPlainText(message.payload),
    attachments: extractAttachments(message.payload),
    labelIds: message.labelIds ?? [],
  };
}

/**
 * Search Gmail with a raw Gmail search query (same syntax as the Gmail search box,
 * e.g. "from:stripe.com failed payment", "newer_than:7d").
 */
export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults = 25,
): Promise<GmailMessage[]> {
  const gmail = getClient(accessToken);

  const list = await withBackoff(() =>
    gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    }),
  );

  const ids = list.data.messages ?? [];
  if (ids.length === 0) return [];

  // Bounded, not Promise.all: a 100-message sync used to fire 100 full-format
  // messages.get calls at once and trip Gmail's per-user per-minute quota
  // ("Quota exceeded for quota metric 'Total Query Cost'", seen 2026-10-07).
  const messages = await mapWithConcurrency(ids, GMAIL_FETCH_CONCURRENCY, (m) =>
    withBackoff(() =>
      gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" }).then((r) => r.data),
    ),
  );

  return messages.map(toGmailMessage);
}

/**
 * Real gap found live (2026-08-18): with an unfiltered "" query, the top-N
 * most-recent-across-all-mail window fills up with Promotions/Social noise
 * (newsletters, LinkedIn notifications, etc.) on a busy inbox, silently
 * pushing a genuinely important thread (e.g. an interview-scheduling email
 * from the day before) out of the ingested window entirely — confirmed via
 * a direct query showing the thread WAS reachable by Gmail's API, just not
 * inside the unfiltered top-N. Excluding these two low-signal categories
 * isn't a semantic narrowing of "recent Gmail" so much as removing mail
 * that was never going to be a Tier 1/2 answer anyway, freeing real
 * capacity in a capped window for what actually matters.
 */
export async function listRecentMessages(accessToken: string, maxResults = 25) {
  return searchMessages(accessToken, "-category:promotions -category:social", maxResults);
}

function buildRawReplyMime({
  to,
  subject,
  inReplyTo,
  body,
}: {
  to: string;
  subject: string;
  inReplyTo?: string;
  body: string;
}): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    // In-Reply-To/References are what let Gmail attach this to the existing
    // thread rather than starting a new one — both need the original
    // message's actual RFC 2822 Message-ID header, not Gmail's API id.
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    inReplyTo ? `References: ${inReplyTo}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");

  return Buffer.from(`${headers}\r\n\r\n${body}`).toString("base64url");
}

/**
 * Creates a Gmail DRAFT replying to the given thread — never sends. Reads the
 * thread's most recent message to reply to the right person with proper
 * threading headers, then calls drafts.create (never drafts.send/messages.send
 * anywhere in this codebase — see the scope comment in auth.ts).
 */
export async function createDraftReply(
  accessToken: string,
  { threadId, body }: { threadId: string; body: string },
): Promise<{ draftId: string; to: string; subject: string; webLink: string }> {
  const gmail = getClient(accessToken);

  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Message-ID"],
  });

  const messages = thread.data.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    throw new Error(`Gmail thread ${threadId} has no messages to reply to`);
  }

  const headers = lastMessage.payload?.headers;
  const from = headerValue(headers, "From");
  const originalSubject = headerValue(headers, "Subject");
  const messageIdHeader = headerValue(headers, "Message-ID");
  const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;

  const raw = buildRawReplyMime({ to: from, subject, inReplyTo: messageIdHeader || undefined, body });

  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId } },
  });

  return {
    draftId: draft.data.id ?? "",
    to: from,
    subject,
    webLink: `https://mail.google.com/mail/u/0/#drafts/${draft.data.message?.id ?? ""}`,
  };
}
