import type { Db } from "./db.ts";
import { toIso } from "./format.ts";
import { HIT_TYPE_BY_SOURCE, type BrainSearchHit, type SourceKind } from "./types.ts";

const CANDIDATES = 30;
const MAX_TERMS = 12;
const RRF_K = 60;

/** Reciprocal Rank Fusion: an id's score is the sum of 1/(k + rank) across the lists it appears in. */
export function rrfFuse(lists: string[][], k = RRF_K): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return Array.from(scores, ([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

/**
 * OR, not AND: Postgres's websearch_to_tsquery ANDs every word, so a full
 * sentence like "Update me for the TCS mail which came?" matched zero documents
 * (verified 2026-10-07). With OR and the english config (which drops stop words),
 * documents matching more of the rare terms rank higher. Built with `new RegExp`
 * because this project's TS target (ES2017) rejects \p{...} regex literals. Combining marks
 * (\p{M}) are part of a word, so accented and Devanagari-style text is not split mid-word.
 */
export function buildTsQuery(question: string): string | null {
  const terms = Array.from(new Set(question.toLowerCase().match(new RegExp("[\\p{L}\\p{N}\\p{M}]+", "gu")) ?? [])).slice(
    0,
    MAX_TERMS,
  );
  return terms.length > 0 ? terms.join(" | ") : null;
}

export function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export type SearchOptions = {
  query: string;
  queryEmbedding?: number[] | null;
  source?: SourceKind;
  limit?: number;
};

type HitRow = {
  id: string;
  source: SourceKind;
  title: string;
  url: string | null;
  doc_date: Date | string | null;
  event_id: string | null;
  body: string;
  headline: string | null;
};

// ts_headline's default <b> tags would be indistinguishable from a literal "<b>" in the body, so use
// markers that cannot plausibly occur in a document and strip exactly those.
const HIGHLIGHT_START = "@@enagram-hl@@";
const HIGHLIGHT_STOP = "@@/enagram-hl@@";

function snippetOf(row: HitRow): string {
  const marked = row.headline || row.body;
  const text = marked.split(HIGHLIGHT_START).join("").split(HIGHLIGHT_STOP).join("").replace(/\s+/g, " ").trim();
  return text.slice(0, 600);
}

export async function searchDocuments(db: Db, options: SearchOptions): Promise<BrainSearchHit[]> {
  const { query, queryEmbedding = null, source = null, limit = 10 } = options;
  const tsQuery = buildTsQuery(query);

  const keywordRows = tsQuery
    ? await db.query<{ id: string }>(
        `select id from enagram_documents, to_tsquery('english', $1::text) q
          where fts @@ q and ($2::text is null or source = $2::text)
          order by ts_rank_cd(fts, q) desc, doc_date desc nulls last
          limit ${CANDIDATES}`,
        [tsQuery, source],
      )
    : [];

  const vectorRows = queryEmbedding
    ? await db.query<{ id: string }>(
        `select id from enagram_documents
          where embedding is not null and ($2::text is null or source = $2::text)
          order by embedding <=> $1::vector
          limit ${CANDIDATES}`,
        [vectorLiteral(queryEmbedding), source],
      )
    : [];

  const fused = rrfFuse([keywordRows.map((r) => r.id), vectorRows.map((r) => r.id)]).slice(0, limit);
  if (fused.length === 0) return [];

  const rows = await db.query<HitRow>(
    `select id, source, title, url, doc_date, event_id, left(body, 2000) as body,
            case when $2::text is not null and fts @@ to_tsquery('english', $2::text)
                 then ts_headline('english', left(body, 20000), to_tsquery('english', $2::text),
                                  'MaxWords=60, MinWords=25, MaxFragments=1, StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_STOP}')
            end as headline
       from enagram_documents where id = any($1::text[])`,
    [fused.map((f) => f.id), tsQuery],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));

  return fused.flatMap(({ id, score }) => {
    const row = byId.get(id);
    if (!row) return [];
    return [
      {
        slug: row.id,
        type: HIT_TYPE_BY_SOURCE[row.source],
        title: row.title,
        score: Math.round(score * 10_000) / 10_000,
        snippet: snippetOf(row),
        url: row.url ?? undefined,
        date: toIso(row.doc_date),
        eventId: row.event_id ?? undefined,
      },
    ];
  });
}
