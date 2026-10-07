import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CalendarBoard } from "./CalendarBoard";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) {
    redirect("/");
  }

  // No ingestionEnabled prop needed here: the fire-and-forget re-sync
  // gating (local-dev only, see trigger-resync.ts) happens server-side in
  // the mutating API routes themselves, not in this client component.
  return <CalendarBoard />;
}
