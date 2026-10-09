import type { Metadata } from "next";
import { Archivo, DM_Sans, Caveat } from "next/font/google";
import "./globals.css";
import { ThemeProvider, NO_FLASH_THEME_SCRIPT } from "./ThemeProvider";
import { PageTransition } from "./PageTransition";

// STICKER type: Archivo (variable, wide) for display headings, DM Sans for
// everything read at length, Caveat for short handwritten annotations only.
const displayFont = Archivo({ variable: "--font-display", subsets: ["latin"], axes: ["wdth"], display: "swap" });
const sansFont = DM_Sans({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const handFont = Caveat({ variable: "--font-hand", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Enagram.io",
  description: "A conversational agent over your own Gmail, Drive, and Calendar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${sansFont.variable} ${handFont.variable} h-full antialiased`}
      // The no-flash script below sets [data-theme] on this element before
      // React hydrates, on purpose — the server has no way to know the
      // client's saved localStorage preference. That's a deliberate,
      // expected mismatch (the standard pattern for avoiding a flash of
      // the wrong theme), not a bug to silently patch around elsewhere.
      suppressHydrationWarning
    >
      <head>
        {/* Sets [data-theme] before hydration/paint so switching themes
            doesn't flash the wrong palette on load. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeProvider>
          <PageTransition>{children}</PageTransition>
        </ThemeProvider>
      </body>
    </html>
  );
}
