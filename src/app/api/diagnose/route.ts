import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { timeSteps } from "@/lib/diagnostics";
import { getDb, getEmbedder } from "@/lib/store/service";
import { searchDocuments } from "@/lib/store/search";

export const maxDuration = 60;

/**
 * Signed-in-only timing report for the chain the chat depends on, so a slow or
 * failing chat can be pinned on one layer without anyone handling a secret.
 * Open it in the browser while signed in.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const query = (req.nextUrl.searchParams.get("q") ?? "job interview schedule").slice(0, 200);
  const embedder = getEmbedder();
  let queryEmbedding: number[] | null = null;

  const timings = await timeSteps([
    {
      call: "database ping",
      run: async () => {
        await (await getDb()).query("select 1");
      },
    },
    {
      call: "keyword search",
      run: async () => searchDocuments(await getDb(), { query, queryEmbedding: null, limit: 5 }),
    },
    {
      call: "gemini embedding",
      run: async () => {
        queryEmbedding = await embedder.query(query);
      },
    },
    {
      call: "keyword + vector search",
      run: async () => searchDocuments(await getDb(), { query, queryEmbedding, limit: 5 }),
    },
  ]);

  return NextResponse.json({ vercelRegion: process.env.VERCEL_REGION ?? "local", query, timings });
}
