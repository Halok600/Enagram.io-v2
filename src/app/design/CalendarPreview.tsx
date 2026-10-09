"use client";

import { useEffect, useLayoutEffect } from "react";
import { CalendarBoard } from "../calendar/CalendarBoard";
import { EventModal } from "../calendar/EventModal";
import { calendarFixtureEvent, installCalendarFetchStub } from "./calendarFixtures";

export const CALENDAR_VIEWS = ["calendar-month", "calendar-week", "calendar-empty", "calendar-loading", "event-create", "event-view", "event-edit"];

const noop = () => {};

// The real CalendarBoard (and EventModal) with a stubbed fetch. The stub goes in a layout effect: those run for the
// whole tree before any passive effect, so it is in place before the board's first request, and it is put back when
// the view unmounts.
export function CalendarPreview({ view }: { view: string }) {
  useLayoutEffect(() => installCalendarFetchStub({ empty: view === "calendar-empty", hang: view === "calendar-loading" }), [view]);

  // The board has no "start in week view" prop, so the week view clicks its own WEEK sticker once, like a user.
  useEffect(() => {
    if (view !== "calendar-week") return;
    const weekButton = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Calendar view"] button')].find(
      (b) => b.textContent?.trim() === "WEEK",
    );
    if (weekButton && weekButton.getAttribute("aria-pressed") === "false") weekButton.click();
  }, [view]);

  const event = calendarFixtureEvent(new Date());
  return (
    <>
      <CalendarBoard email="sam@example.com" />
      {view === "event-create" ? <EventModal mode="create" initialDate={new Date()} onClose={noop} onSaved={noop} /> : null}
      {view === "event-view" ? <EventModal mode="view" event={event} onClose={noop} onSaved={noop} /> : null}
      {view === "event-edit" ? <EventModal mode="edit" event={event} onClose={noop} onSaved={noop} /> : null}
    </>
  );
}
