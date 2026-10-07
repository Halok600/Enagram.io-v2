export type BrainDocument = {
  id: string; // source-prefixed unique id, e.g. "gmail:<messageId>"
  source: "gmail" | "drive" | "calendar";
  title: string; // subject line / file name
  body: string; // email plaintext body / extracted doc text
  participants: string[]; // email addresses involved (to/from/cc/owners), for cross-source joins
  attachments: { name: string; driveFileId?: string }[];
  timestamp: string; // ISO 8601
  url?: string; // deep link back to the source (Gmail thread / Drive webViewLink)
  raw: Record<string, unknown>; // original API payload, for debugging/audit
};
