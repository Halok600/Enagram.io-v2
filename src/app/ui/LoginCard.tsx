import type { ReactNode } from "react";
import { Card } from "./Card";
import { LogoMark } from "./LogoMark";
import { Stamp } from "./Stamp";
import { StickerButton } from "./StickerButton";

// The login screen markup, shared by the real page (a server component) and the /design preview. The page puts
// its own <form action={...}> around ConnectGoogleButton; the preview renders a non-submitting button instead.
export function LoginCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] px-4 py-10">
      <main className="w-full max-w-2xl">
        <Card shadow="lg" className="flex flex-col gap-7 p-6 sm:p-10">
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-end gap-4">
              <LogoMark size={88} tilt className="max-sm:h-18 max-sm:w-18" />
              <Stamp tone="sun" className="mb-2">
                Login
              </Stamp>
            </div>
            <h1 className="font-display text-[clamp(2rem,9.5vw,4.75rem)]">ENAGRAM*</h1>
            <p className="font-hand text-2xl text-[var(--ink-soft)] sm:text-3xl">your mail, files and week, in one place</p>
          </div>
          <p className="text-lg leading-relaxed">
            Connect your Google account to let the brain read your Gmail and Drive, and read, create, and manage your Calendar.
          </p>
          {children}
        </Card>
      </main>
    </div>
  );
}

/** The one big button of the login screen. `type="submit"` inside the page's form; "button" in the preview. */
export function ConnectGoogleButton({ type = "submit" }: { type?: "submit" | "button" }) {
  return (
    <StickerButton type={type} tone="cobalt" size="lg" className="w-full px-3! text-base! whitespace-nowrap sm:min-h-16 sm:px-7! sm:text-2xl!">
      CONNECT GOOGLE
    </StickerButton>
  );
}
