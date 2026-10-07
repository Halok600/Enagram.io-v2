import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { searchMessages } from "@/lib/google/gmail";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const query = req.nextUrl.searchParams.get("q") ?? "";
  const maxResults = Number(req.nextUrl.searchParams.get("max") ?? "10");

  try {
    const messages = await searchMessages(session.accessToken, query, maxResults);
    return NextResponse.json({ count: messages.length, messages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gmail API request failed" }, { status: 502 });
  }
}
