"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Mail, Plus, Trash2 } from "lucide-react";
import { StickerButton } from "../ui/StickerButton";
import { Chip } from "../ui/Chip";
import { Card } from "../ui/Card";
import { Stamp } from "../ui/Stamp";
import { Switch } from "../ui/Switch";
import { Field } from "../ui/Field";
import { TapeStrip } from "../ui/TapeStrip";
import { Ticket } from "../ui/Ticket";
import { WorkingTicker } from "../ui/WorkingTicker";
import { TAPE_ITEMS, TICKER_NAMES, TICKETS, TONES } from "./fixtures";

type Props = { theme: "dark" | "light"; view: string; section?: string };

function Section({ id, title, note, only, children }: { id: string; title: string; note: string; only?: string; children: ReactNode }) {
  if (only && only !== id) return null;
  return (
    <section aria-labelledby={`h-${id}`} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
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
          <TapeStrip items={TAPE_ITEMS} onRetry={() => {}} />
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

export function DesignPreview({ theme, view, section }: Props) {
  // A plain attribute assignment (no setState). The no-flash script already set the stored theme; the URL wins here.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-8 md:py-14">
        <header className="flex flex-col gap-3">
          <p className="font-hand text-2xl text-[var(--ink-soft)]">development only</p>
          <h1 className="font-display text-5xl md:text-7xl">Sticker kit</h1>
        </header>
        {view === "kit" ? <Kit section={section} /> : <p className="font-display text-2xl">Unknown view: {view}</p>}
      </main>
    </div>
  );
}
