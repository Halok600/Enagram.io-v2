import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrainDocument } from "./types";
import { brainDocumentPagePath, brainDocumentToMarkdown } from "./markdown";

// The gbrain "brain repo" — see JOURNAL.md 2026-08-03. Gitignored; holds real
// personal data once ingestion runs.
const BRAIN_REPO_DIR = path.join(process.cwd(), "brain");

export async function writeBrainPage(doc: BrainDocument): Promise<string> {
  const relativePath = brainDocumentPagePath(doc);
  const absolutePath = path.join(BRAIN_REPO_DIR, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, brainDocumentToMarkdown(doc), "utf-8");

  return relativePath;
}

export async function writeBrainPages(docs: BrainDocument[]): Promise<string[]> {
  return Promise.all(docs.map(writeBrainPage));
}
