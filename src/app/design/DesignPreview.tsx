"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Mail, Plus, Trash2 } from "lucide-react";
import { StickerButton } from "../ui/StickerButton";
import { CalendarPeek } from "../ui/CalendarPeek";
import { Chip } from "../ui/Chip";
import { Card } from "../ui/Card";
import { Stamp } from "../ui/Stamp";
import { Switch } from "../ui/Switch";
import { Field } from "../ui/Field";
import { TapeSlot } from "../ui/TapeSlot";
import { TopBar } from "../ui/TopBar";
import { Chat } from "../chat/Chat";
import { ConnectGoogleButton, LoginCard } from "../ui/LoginCard";
import { CALENDAR_VIEWS, CalendarPreview } from "./CalendarPreview";
import { Ticket } from "../ui/Ticket";
import { WorkingTicker } from "../ui/WorkingTicker";
import { LogoView } from "./LogoView";
import {
  APPROVAL_LONG_MESSAGES,
  PEEK_EMPTY,
  PEEK_ERROR,
  PEEK_LOADED,
  APPROVAL_SHORT_MESSAGES,
  CHAT_SHELL_TAPES,
  CONVERSATION_MESSAGES,
  CONVERSATION_TIMES,
  FIXTURE_ANSWER_TIME,
  TAPE_ITEMS,
  TICKER_NAMES,
  TICKETS,
  TONES,
  WORKING_MESSAGES,
} from "./fixtures";
import type { UIMessage } from "ai";
import type { TapeItem } from "@/lib/ui/tape";

type Props = { theme: "dark" | "light"; view: string; section?: string };

function Section({ id, title, note, only, wide, children }: { id: string; title: string; note: string; only?: string; wide?: boolean; children: ReactNode }) {
  if (only && only !== id) return null;
  return (
    <section aria-labelledby={`h-${id}`} className="flex flex-col gap-5">
      <div className={`flex flex-wrap items-end gap-x-4 gap-y-1 ${wide ? "px-4 sm:px-8" : ""}`}>
        <h2 id={`h-${id}`} className="font-display text-3xl md:text-4xl">
          {title}
        </h2>
        <span className="font-hand text-xl text-[var(--ink-soft)] md:text-2xl">{note}</span>
      </div>
      {children}
    </section>
  );
}

function Kit({ section }: { section?: string }) {
  const [daily, setDaily] = useState(true);
  const [sound, setSound] = useState(false);
  return (
    <div className="flex flex-col gap-14">
      <Section id="buttons" title="Buttons" note="press one, feel the thunk" only={section}>
        <div className="flex flex-wrap items-center gap-5">
          {(["plain", "cobalt", "sun", "bubblegum", "danger"] as const).map((tone) => (
            <StickerButton key={tone} tone={tone}>
              {tone}
            </StickerButton>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <StickerButton tone="cobalt" size="lg">
            Connect Google <ArrowRight aria-hidden size={20} strokeWidth={3} />
          </StickerButton>
          <StickerButton tone="sun" size="lg">
            <Plus aria-hidden size={20} strokeWidth={3} /> New event
          </StickerButton>
          <StickerButton tone="danger">
            <Trash2 aria-hidden size={16} strokeWidth={3} /> Delete
          </StickerButton>
          <StickerButton tone="cobalt" disabled>
            Disabled
          </StickerButton>
        </div>
      </Section>

      <Section id="chips" title="Chips" note="tilt on hover" only={section}>
        <div className="flex flex-wrap items-center gap-4">
          {TONES.map((tone) => (
            <Chip key={tone} tone={tone} onClick={() => {}}>
              {tone}
            </Chip>
          ))}
          <Chip tone="cobalt" icon={<Mail size={15} strokeWidth={2.5} />} href="#chips">
            Gmail link
          </Chip>
          <Chip tone="sun" icon={<Mail size={15} strokeWidth={2.5} />}>
            163 docs indexed
          </Chip>
          <Chip tone="bubblegum" disabled onClick={() => {}}>
            disabled
          </Chip>
        </div>
      </Section>

      <Section id="cards" title="Cards" note="never tilted, they carry text" only={section}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(["none", "sm", "md", "lg"] as const).map((shadow) => (
            <Card key={shadow} shadow={shadow} className="p-5">
              <p className="font-display text-xl">shadow {shadow}</p>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">A flat panel with a 2.5px outline and a hard offset shadow.</p>
            </Card>
          ))}
          {(["sun", "cobalt", "bubblegum"] as const).map((tone) => (
            <Card key={tone} tone={tone} className="p-5">
              <p className="font-display text-xl">{tone} card</p>
              <p className="mt-2 text-sm">Fill from the token, text from its paired on-colour.</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="stamps" title="Stamps" note="small, tilted, loud" only={section}>
        <div className="flex flex-wrap items-center gap-6">
          {TONES.map((tone) => (
            <Stamp key={tone} tone={tone}>
              {tone === "plain" ? "Today" : tone === "cobalt" ? "Brain" : tone === "sun" ? "New" : "+2 more"}
            </Stamp>
          ))}
        </div>
      </Section>

      <Section id="switch" title="Switch" note="a real checkbox underneath" only={section}>
        <div className="flex flex-wrap items-center gap-8">
          <Switch checked={daily} onChange={setDaily} label="All-day event (on)" />
          <Switch checked={sound} onChange={setSound} label="Chunky switch (off)" />
          <Switch checked={false} onChange={() => {}} label="Theme" hideLabel />
        </div>
      </Section>

      <Section id="fields" title="Fields" note="tab into one" only={section}>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Title" id="kit-title" placeholder="Lunch with the team" />
          <Field label="Notes" id="kit-notes" multiline placeholder="Anything worth remembering" />
        </div>
      </Section>

      <Section id="tape" title="Tape strip" note="one of every tone" only={section}>
        <div className="py-4">
          <TapeSlot items={TAPE_ITEMS} onRetry={() => {}} />
        </div>
      </Section>

      <Section id="tickets" title="Tickets" note="ticket stubs" only={section}>
        <div className="grid gap-6 md:grid-cols-3">
          {TICKETS.map((t) => (
            <Ticket key={t.n} {...t} />
          ))}
        </div>
      </Section>

      <Section id="ticker" title="Working ticker" note="searching…" only={section}>
        <div className="flex flex-col gap-6 py-2">
          <WorkingTicker names={TICKER_NAMES} />
          <WorkingTicker names={[]} />
        </div>
      </Section>
    </div>
  );
}

// A frame that behaves like the page container of the real screens: it hides horizontal overflow (the tape strip is
// wider than the page on purpose) and holds the top bar, the tape slot and the chat in the same order as Workspace.
function Frame({ children, minHeight }: { children: ReactNode; minHeight?: number }) {
  return (
    <div className="flex flex-col overflow-x-clip border-[length:var(--stroke)] border-dashed border-[var(--ink-soft)] bg-[var(--bg)] pb-4" style={{ minHeight }}>
      {children}
    </div>
  );
}

const noop = () => {};

function ChatShell({ section }: { section?: string }) {
  return (
    <div className="flex flex-col gap-12">
      <Section id="bar" title="Top bar" note="idle, syncing, calendar" only={section} wide>
        <div className="flex flex-col gap-8">
          <Frame>
            <TopBar email="sam@example.com" documents={163} sync={{ state: "idle", run: noop }} variant="chat" />
          </Frame>
          <Frame>
            <TopBar email="sam@example.com" documents={163} sync={{ state: "loading", run: noop }} variant="chat" />
          </Frame>
          <Frame>
            <TopBar email="sam@example.com" documents={null} sync={{ state: "idle", run: noop }} variant="calendar" />
          </Frame>
        </div>
      </Section>

      <Section id="menu" title="Folded menu" note="below 768px" only={section} wide>
        <Frame minHeight={520}>
          <TopBar email="sam@example.com" documents={163} sync={{ state: "loading", run: noop }} variant="chat" defaultOpen />
        </Frame>
      </Section>

      <Section id="tapes" title="Tape situations" note="database, chat error, sync waiting" only={section} wide>
        <div className="flex flex-col gap-8">
          {CHAT_SHELL_TAPES.map((t) => (
            <Frame key={t.label}>
              <TopBar email="sam@example.com" documents={163} sync={{ state: t.syncState, run: noop }} variant="chat" />
              <TapeSlot items={t.items} onRetry={noop} />
            </Frame>
          ))}
        </div>
      </Section>

      <Section id="empty" title="Empty transcript" note="the whole shell" only={section} wide>
        <div className="flex h-[720px] flex-col overflow-hidden border-[length:var(--stroke)] border-dashed border-[var(--ink-soft)] bg-[var(--bg)]">
          <TopBar email="sam@example.com" documents={163} sync={{ state: "idle", run: noop }} variant="chat" />
          <TapeSlot items={[]} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 pb-3 md:px-6 md:pb-5">
            <Chat
              name="Sam Example"
              messages={[]}
              status="ready"
              userTimestamps={[]}
              assistantTimestamps={{}}
              activeTools={[]}
              onSend={noop}
              onApprovalResponse={noop}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

// The signed-in empty screen at viewport size: top bar, tape slot and the chat, as Workspace composes them.
function ChatEmpty() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--bg)]">
      <TopBar email="sam@example.com" documents={163} sync={{ state: "idle", run: noop }} variant="chat" />
      <TapeSlot items={[]} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 pb-3 md:px-6 md:pb-5">
        <Chat name="Sam Example" messages={[]} status="ready" userTimestamps={[]} assistantTimestamps={{}} activeTools={[]} onSend={noop} onApprovalResponse={noop} />
      </main>
    </div>
  );
}

// A signed-in chat screen at content height (the page grows with the transcript, so a screenshot shows all of it).
function ChatScreen({
  messages,
  status = "ready",
  activeTools = [],
  assistantTimestamps,
  height,
  tape = [],
}: {
  tape?: TapeItem[];
  messages: UIMessage[];
  status?: "ready" | "submitted" | "streaming";
  activeTools?: readonly string[];
  assistantTimestamps?: Record<string, number>;
  height?: number;
}) {
  return (
    <div className="flex w-full flex-col overflow-x-clip bg-[var(--bg)]" style={height ? { height } : { minHeight: "100vh" }}>
      <TopBar email="sam@example.com" documents={163} sync={{ state: "idle", run: noop }} variant="chat" />
      <TapeSlot items={tape} onRetry={noop} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 pb-3 md:px-6 md:pb-5">
        <Chat
          name="Sam Example"
          messages={messages}
          status={status}
          userTimestamps={CONVERSATION_TIMES.user}
          assistantTimestamps={assistantTimestamps ?? { a1: FIXTURE_ANSWER_TIME, a2: FIXTURE_ANSWER_TIME }}
          activeTools={activeTools}
          onSend={noop}
          onApprovalResponse={noop}
        />
      </main>
    </div>
  );
}

function ChatWorking() {
  return (
    <div className="flex flex-col gap-10 bg-[var(--bg)]">
      <ChatScreen messages={WORKING_MESSAGES} status="submitted" activeTools={TICKER_NAMES} height={520} />
      <ChatScreen messages={WORKING_MESSAGES} status="submitted" activeTools={[]} height={520} />
    </div>
  );
}

// Every tape situation at once: all five items in one strip, then each alone, so the tones can be compared.
function TapeAll() {
  return (
    <div className="flex flex-col gap-10 overflow-x-clip pb-10">
      <TopBar email="sam@example.com" documents={163} sync={{ state: "loading", run: noop }} variant="chat" />
      <section aria-label="All tape messages together" className="flex flex-col gap-3">
        <p className="font-hand px-4 text-2xl text-[var(--ink-soft)] sm:px-8">all together</p>
        <TapeSlot items={TAPE_ITEMS} onRetry={noop} />
      </section>
      {TAPE_ITEMS.map((item) => (
        <section key={item.id} aria-label={`Tape message: ${item.id}`} className="flex flex-col gap-3">
          <p className="font-hand px-4 text-2xl text-[var(--ink-soft)] sm:px-8">{item.id}</p>
          <TapeSlot items={[item]} onRetry={noop} />
        </section>
      ))}
    </div>
  );
}

const loadedPeek = () => Promise.resolve(PEEK_LOADED);
const emptyPeek = () => Promise.resolve(PEEK_EMPTY);
const errorPeek = () => Promise.resolve(PEEK_ERROR);
const neverPeek = () => new Promise<never>(() => {});

// The calendar hover card in each of its states, open from the start. From 768px up it shows under the chip;
// below that nothing opens (the chip simply links to /calendar), so the 390px picture shows only the chips.
function CalendarPeekView() {
  const states = [
    { label: "loaded: 3 events, one all-day", fetchSummary: loadedPeek },
    { label: "empty", fetchSummary: emptyPeek },
    { label: "loading", fetchSummary: neverPeek },
    { label: "error", fetchSummary: errorPeek },
  ];
  return (
    <div className="flex flex-col gap-10 px-4 py-10 sm:px-8 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="font-hand text-2xl text-[var(--ink-soft)]">development only</p>
        <h1 className="font-display text-5xl md:text-7xl">Calendar peek</h1>
      </header>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
        {states.map((s) => (
          <section key={s.label} aria-label={s.label} className="flex flex-col gap-4 md:min-h-[28rem]">
            <p className="font-hand text-2xl text-[var(--ink-soft)]">{s.label}</p>
            <div>
              <CalendarPeek defaultOpen fetchSummary={s.fetchSummary}>
                <Chip href="/calendar" icon={<CalendarDays size={16} strokeWidth={2.5} />}>
                  Calendar
                </Chip>
              </CalendarPeek>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const CHAT_VIEWS = ["tape-all", "chat-error", "chat-conversation", "chat-approval-short", "chat-approval-long", "chat-working"];

export function DesignPreview({ theme, view, section }: Props) {
  // A plain attribute assignment (no setState). The no-flash script already set the stored theme; the URL wins here.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Full-screen views render exactly like the real screens, without the preview's own heading.
  if (CHAT_VIEWS.includes(view)) {
    return (
      <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
        {view === "tape-all" ? (
          <TapeAll />
        ) : view === "chat-error" ? (
          <ChatScreen messages={CONVERSATION_MESSAGES.slice(0, 1)} tape={[TAPE_ITEMS[1]]} />
        ) : view === "chat-conversation" ? (
          <ChatScreen messages={CONVERSATION_MESSAGES} />
        ) : view === "chat-approval-short" ? (
          <ChatScreen messages={APPROVAL_SHORT_MESSAGES} />
        ) : view === "chat-approval-long" ? (
          <ChatScreen messages={APPROVAL_LONG_MESSAGES} />
        ) : (
          <ChatWorking />
        )}
      </div>
    );
  }

  if (CALENDAR_VIEWS.includes(view)) {
    return (
      <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
        <CalendarPreview view={view} />
      </div>
    );
  }

  if (view === "calendar-peek") {
    return (
      <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
        <CalendarPeekView />
      </div>
    );
  }

  if (view === "logo") {
    return (
      <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
        <LogoView />
      </div>
    );
  }

  if (view === "chat-empty" || view === "login") {
    return (
      <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
        {view === "chat-empty" ? (
          <ChatEmpty />
        ) : (
          <LoginCard>
            <ConnectGoogleButton type="button" />
          </LoginCard>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
      <main className={`mx-auto flex flex-col gap-12 py-10 md:py-14 ${view === "chat-shell" ? "px-0" : "max-w-6xl px-4 sm:px-8"}`}>
        <header className={`flex flex-col gap-3 ${view === "chat-shell" ? "px-4 sm:px-8" : ""}`}>
          <p className="font-hand text-2xl text-[var(--ink-soft)]">development only</p>
          <h1 className="font-display text-5xl md:text-7xl">Sticker kit</h1>
        </header>
        {view === "kit" ? <Kit section={section} /> : view === "chat-shell" ? <ChatShell section={section} /> : <p className="font-display text-2xl">Unknown view: {view}</p>}
      </main>
    </div>
  );
}
