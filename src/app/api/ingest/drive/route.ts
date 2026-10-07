import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { searchFiles } from "@/lib/google/drive";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const query = req.nextUrl.searchParams.get("q") ?? "";
  const maxResults = Number(req.nextUrl.searchParams.get("max") ?? "10");

  try {
    const files = await searchFiles(session.accessToken, query, maxResults);
    return NextResponse.json({ count: files.length, files });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Drive API request failed" }, { status: 502 });
  }
}
