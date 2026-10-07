import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider, NO_FLASH_THEME_SCRIPT } from "./ThemeProvider";
import { PageTransition } from "./PageTransition";

// Two fonts, deliberately: Inter for everything read at length (chat,
// body copy) since legibility matters more there than personality, and
// Space Grotesk reserved for the brand name only (the "font-display"
// Tailwind utility, applied where the app name itself renders) — enough
// character to feel distinct without making anything hard to read.
const sansFont = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

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
      className={`${sansFont.variable} ${displayFont.variable} h-full antialiased`}
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
