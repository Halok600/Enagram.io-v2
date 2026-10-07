import type { Source } from "./SourceChip";

const RELEVANCE_THRESHOLD = 0.5;
const MAX_SOURCES_SHOWN = 6;

type ToolResultPart = {
  type: string;
  state?: string;
  output?: unknown;
};

type ToolOutput = {
  results?: { title: string; slug: string; score: number; url?: string }[];
};

/**
 * The model often calls the same tool multiple times with overlapping/rephrased
 * queries in one turn, so raw results can contain the same page repeatedly
 * (which also breaks React's key uniqueness) and a long tail of low-relevance
 * matches. Dedupe by slug (keep the best score seen), drop anything below a
 * relevance floor, and cap the count so the footnote stays a quick citation
 * list rather than a dump of every result the model glanced at.
 */
export function extractSources(parts: ReadonlyArray<ToolResultPart>): Source[] {
  const bySlug = new Map<string, Source>();

  for (const part of parts) {
    if (part.type !== "tool-search_gmail" && part.type !== "tool-search_drive") continue;
    if (part.state !== "output-available") continue;

    const tool = part.type === "tool-search_gmail" ? "search_gmail" : "search_drive";
    const output = part.output as ToolOutput | undefined;

    for (const r of output?.results ?? []) {
      if (r.score < RELEVANCE_THRESHOLD) continue;
      const existing = bySlug.get(r.slug);
      if (!existing || r.score > existing.score) {
        bySlug.set(r.slug, { tool, title: r.title, slug: r.slug, score: r.score, url: r.url });
      }
    }
  }

  return Array.from(bySlug.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES_SHOWN);
}
