"use client";

/* eslint-disable @next/next/no-img-element -- the preview shows the real served icon files at exact pixel sizes. */
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { LogoMark } from "../ui/LogoMark";
import { TopBar } from "../ui/TopBar";

const SIZES = [16, 32, 48, 96, 180];
const noop = () => {};

/** Rasterises /icon.svg at `px` (as a browser tab does) and shows it enlarged with hard pixels, to judge legibility. */
function Pixels({ px, scale }: { px: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(img, 0, 0, px, px);
    };
    img.src = "/icon.svg";
  }, [px]);
  return (
    <figure className="flex flex-col items-start gap-2">
      <canvas ref={ref} width={px} height={px} style={{ width: px * scale, height: px * scale, imageRendering: "pixelated" }} />
      <figcaption className="font-hand text-xl text-[var(--ink-soft)]">
        {px}px, x{scale}
      </figcaption>
    </figure>
  );
}

// A mock browser tab strip (fixed browser chrome colours, not app tokens) with the real 16px favicon.
function TabStrip({ dark }: { dark: boolean }) {
  const strip = dark ? "#202124" : "#dee1e6";
  const tab = dark ? "#35363a" : "#ffffff";
  const text = dark ? "#e8eaed" : "#1f1f1f";
  return (
    <div className="flex items-end overflow-hidden px-2 pt-2" style={{ background: strip, color: text, fontFamily: "system-ui, sans-serif", fontSize: 12 }}>
      <div className="flex h-9 w-52 items-center gap-2 rounded-t-lg px-3" style={{ background: tab }}>
        <img src="/icon.svg" width={16} height={16} alt="" />
        <span className="flex-1">Enagram.io</span>
        <X aria-hidden size={12} strokeWidth={2} />
      </div>
      <div className="flex h-9 w-40 items-center gap-2 px-3 opacity-70">
        <span className="inline-block h-4 w-4 rounded-full" style={{ background: text }} />
        <span>Another tab</span>
      </div>
    </div>
  );
}

// `bleed` lets the content run edge to edge (the top bar has its own page padding).
function Block({ title, note, bleed, children }: { title: string; note: string; bleed?: boolean; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-4 ${bleed ? "" : "px-4 sm:px-8"}`}>
      <div className={`flex flex-wrap items-end gap-x-4 gap-y-1 ${bleed ? "px-4 sm:px-8" : ""}`}>
        <h2 className="font-display text-2xl md:text-3xl">{title}</h2>
        <span className="font-hand text-xl text-[var(--ink-soft)] md:text-2xl">{note}</span>
      </div>
      {children}
    </section>
  );
}

// The "logo" view of /design: the brand mark at every size, the favicon as a browser draws it, and the mark in context.
export function LogoView() {
  return (
    <div className="flex flex-col gap-12 py-8">
      <Block title="Favicon" note="icon.svg, fixed colours, 16 to 180px">
        <div className="flex flex-wrap items-end gap-6">
          {SIZES.map((s) => (
            <img key={s} src="/icon.svg" width={s} height={s} alt="" />
          ))}
          <img src="/apple-icon.png" width={180} height={180} alt="" />
        </div>
      </Block>
      <Block title="At tab size" note="the real pixels, enlarged">
        <div className="flex flex-wrap items-start gap-8">
          <Pixels px={16} scale={10} />
          <Pixels px={32} scale={5} />
        </div>
      </Block>
      <Block title="Browser tabs" note="dark and light">
        <div className="flex max-w-xl flex-col gap-3">
          <TabStrip dark />
          <TabStrip dark={false} />
        </div>
      </Block>
      <Block title="LogoMark" note="theme tokens, tilt on the right">
        <div className="flex flex-wrap items-end gap-6">
          {SIZES.slice(1).map((s) => (
            <LogoMark key={s} size={s} />
          ))}
          <LogoMark size={96} tilt />
        </div>
      </Block>
      <Block title="In the top bar" note="next to the ENAGRAM* sticker" bleed>
        <TopBar email="sam@example.com" documents={163} sync={{ state: "idle", run: noop }} variant="chat" />
      </Block>
    </div>
  );
}
