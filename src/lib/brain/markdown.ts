import { stringify } from "yaml";
import type { BrainDocument } from "./types";

/**
 * gbrain-base-v2 path prefixes: "email" -> emails/, "source" (generic doc)
 * -> sources/, "event" -> life/events/ (only prefix the schema declares for
 * it — its own comment frames it as "Life Chronicle" personal-timeline
 * events, but primitive: temporal and the literal name "event" make it the
 * closest available fit for calendar events, same reasoning as reusing
 * "source" for Drive files — see JOURNAL.md 2026-08-04/2026-08-09).
 */
const TYPE_BY_SOURCE: Record<BrainDocument["source"], { type: string; dir: string }> = {
  gmail: { type: "email", dir: "emails" },
  drive: { type: "source", dir: "sources" },
  calendar: { type: "event", dir: "life/events" },
};

/** Filesystem/slug-safe id: "gmail:19fc76dd1908a913" -> "gmail-19fc76dd1908a913". */
export function slugify(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function brainDocumentToMarkdown(doc: BrainDocument): string {
  const { type } = TYPE_BY_SOURCE[doc.source];

  const frontmatter = stringify({
    type,
    title: doc.title,
    source: doc.source,
    source_id: doc.id,
    date: doc.timestamp,
    url: doc.url,
    participants: doc.participants,
    attachments: doc.attachments.map((a) => a.name),
  });

  // Participants/source/attachments also live in frontmatter above, but gbrain's
  // search only returns chunked BODY text to callers — frontmatter never reaches
  // the model or the keyword/vector index. An email whose body text never repeats
  // the sender's domain (most don't) is then unfindable/unverifiable for a query
  // like "SkillLayer emails" even though the sender IS nirmit@skillayer.tech.
  // Restating the key metadata as visible body text fixes both retrieval recall
  // and the model's ability to ground an answer in it. See JOURNAL.md 2026-08-04.
  const metadataHeader = [
    `**${doc.title}**`,
    `Participants: ${doc.participants.join(", ") || "(none)"}`,
    doc.attachments.length > 0 ? `Attachments: ${doc.attachments.map((a) => a.name).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `---\n${frontmatter}---\n\n${metadataHeader}\n\n---\n\n${doc.body}\n`;
}

export function brainDocumentPagePath(doc: BrainDocument): string {
  const { dir } = TYPE_BY_SOURCE[doc.source];
  return `${dir}/${slugify(doc.id)}.md`;
}
