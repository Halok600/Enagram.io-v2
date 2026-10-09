import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CalendarBoard } from "./CalendarBoard";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) {
    redirect("/");
  }

  // No sync props are needed here: after a calendar create/update/delete, the mutating API
  // routes call reingestCalendar (src/lib/sync/calendar.ts) server-side, so this client
  // component only renders the board.
  return <CalendarBoard email={session.user?.email ?? ""} />;
}
