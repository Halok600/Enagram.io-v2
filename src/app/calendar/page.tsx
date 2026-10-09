import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CalendarBoard } from "./CalendarBoard";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) {
    redirect("/");
  }

  // The board owns its own useSync/useHealth for the shared top bar (the Sync button and the
  // documents-indexed note), so no sync props are passed from here. Calendar create/update/delete
  // still re-ingest server-side: the mutating API routes call reingestCalendar
  // (src/lib/sync/calendar.ts).
  return <CalendarBoard email={session.user?.email ?? ""} />;
}
