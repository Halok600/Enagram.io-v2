import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignPreview } from "./DesignPreview";

export const metadata: Metadata = { title: "Design preview", robots: { index: false, follow: false } };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Development-only preview of every shared part and screen state, rendered from fixtures.
// In a production build the route does not exist.
export default async function DesignPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const theme = first(sp.theme) === "light" ? "light" : "dark";
  const view = first(sp.view) ?? "kit";
  const section = first(sp.section);
  return <DesignPreview theme={theme} view={view} section={section} />;
}
