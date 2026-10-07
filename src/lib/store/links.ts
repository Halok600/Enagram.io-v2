import type { Db } from "./db.ts";
import { toIso } from "./format.ts";
import { HIT_TYPE_BY_SOURCE, type BrainSearchHit, type SourceKind } from "./types.ts";

export type LinkCandidate = { id: string; source: SourceKind; participants: string[] };
export type LinkPair = { from: string; to: string };

const MAX_DOCS_PER_PARTICIPANT = 6; // mailing lists / frequent contacts are not a meaningful signal
const MAX_LINKS = 200;

/**
 * Deterministic cross-source linking (no LLM judgment): a Gmail thread, a Drive
 * file and a Calendar event that share a participant are almost certainly the
 * same real-world thread. Same rules as v1.
 */
export function buildLinkPairs(docs: LinkCandidate[], ownEmail: string): LinkPair[] {
  const own = ownEmail.trim().toLowerCase();
  const byParticipant = new Map<string, LinkCandidate[]>();
  for (const doc of docs) {
    for (const raw of doc.participants) {
      const participant = raw.trim().toLowerCase();
      if (!participant || participant === own) continue; // the user is on nearly everything
      const list = byParticipant.get(participant) ?? [];
      if (!list.some((d) => d.id === doc.id)) list.push(doc);
      byParticipant.set(participant, list);
    }
  }

  const seen = new Set<string>();
  const pairs: LinkPair[] = [];
  for (const entries of byParticipant.values()) {
    if (entries.length < 2 || entries.length > MAX_DOCS_PER_PARTICIPANT) continue;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].source === entries[j].source) continue; // cross-source only
        const key = [entries[i].id, entries[j].id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ from: entries[i].id, to: entries[j].id });
      }
    }
  }
  return pairs.slice(0, MAX_LINKS);
}

export async function replaceLinks(db: Db, pairs: LinkPair[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(`delete from enagram_links`);
    if (pairs.length === 0) return;
    await tx.query(
      `insert into enagram_links (from_id, to_id)
       select from_id, to_id from jsonb_to_recordset($1::jsonb) as r(from_id text, to_id text)
       on conflict do nothing`,
      [JSON.stringify(pairs.map((p) => ({ from_id: p.from, to_id: p.to })))],
    );
  });
}

export async function rebuildLinks(db: Db, ownEmail: string): Promise<number> {
  const rows = await db.query<{ id: string; source: SourceKind; participants: string[] }>(
    `select id, source, participants from enagram_documents where cardinality(participants) > 0 order by id`,
  );
  const pairs = buildLinkPairs(rows, ownEmail);
  await replaceLinks(db, pairs);
  return pairs.length;
}

export type RelatedPage = {
  slug: string;
  title: string;
  type: BrainSearchHit["type"];
  url?: string;
  date?: string;
};

export async function relatedTo(db: Db, id: string): Promise<{ count: number; results: RelatedPage[] }> {
  const rows = await db.query<{
    id: string;
    title: string;
    source: SourceKind;
    url: string | null;
    doc_date: Date | string | null;
  }>(
    `select d.id, d.title, d.source, d.url, d.doc_date
       from enagram_links l
       join enagram_documents d on d.id = case when l.from_id = $1::text then l.to_id else l.from_id end
      where l.from_id = $1::text or l.to_id = $1::text
      limit 10`,
    [id],
  );
  const results = rows.map((r) => ({
    slug: r.id,
    title: r.title,
    type: HIT_TYPE_BY_SOURCE[r.source],
    url: r.url ?? undefined,
    date: toIso(r.doc_date),
  }));
  return { count: results.length, results };
}
