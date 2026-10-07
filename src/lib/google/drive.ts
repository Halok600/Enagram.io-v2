import { google } from "googleapis";
import { extractText, getDocumentProxy } from "unpdf";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string; // ISO 8601
  webViewLink: string;
  owners: string[];
  content: string; // best-effort extracted text; empty if unsupported/binary
};

const GOOGLE_DOC_EXPORT_MIME = "text/plain";

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

async function extractContent(
  drive: ReturnType<typeof getClient>,
  fileId: string,
  mimeType: string,
): Promise<string> {
  try {
    if (mimeType === "application/vnd.google-apps.document") {
      const res = await drive.files.export(
        { fileId, mimeType: GOOGLE_DOC_EXPORT_MIME },
        { responseType: "text" },
      );
      return res.data as unknown as string;
    }

    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" },
      );
      return res.data as unknown as string;
    }

    // PDFs (resumes, JDs, etc. — real files people actually have in Drive,
    // not just Google Docs) — previously skipped entirely, so a file like
    // "Resume_2026_APRIL.pdf" was only ever findable by filename, never by
    // its actual content. `unpdf` is pdfjs-based but built to run without a
    // canvas/worker dependency, which matters on Vercel's serverless
    // functions where those aren't available.
    if (mimeType === "application/pdf") {
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" },
      );
      const pdf = await getDocumentProxy(new Uint8Array(res.data as ArrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }

    // Other binary formats (images, Slides, Sheets) still skipped — out of
    // scope per SPEC.md; we index metadata (name/owners/dates) only.
    return "";
  } catch (err) {
    console.error(`Failed to extract content for Drive file ${fileId}`, err);
    return "";
  }
}

/**
 * List files matching a Drive query (same syntax as Drive's search operators,
 * e.g. "name contains 'contract'", "modifiedTime > '2026-01-01T00:00:00'").
 * Pass "" for the default recency-ordered listing.
 */
export async function searchFiles(
  accessToken: string,
  query: string,
  maxResults = 25,
): Promise<DriveFile[]> {
  const drive = getClient(accessToken);

  const list = await drive.files.list({
    q: query || undefined,
    pageSize: maxResults,
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName,emailAddress))",
  });

  const files = list.data.files ?? [];

  return Promise.all(
    files.map(async (f) => ({
      id: f.id!,
      name: f.name ?? "",
      mimeType: f.mimeType ?? "",
      modifiedTime: f.modifiedTime ?? "",
      webViewLink: f.webViewLink ?? "",
      owners: (f.owners ?? []).map((o) => o.emailAddress ?? o.displayName ?? "").filter(Boolean),
      content: await extractContent(drive, f.id!, f.mimeType ?? ""),
    })),
  );
}

export async function listRecentFiles(accessToken: string, maxResults = 25) {
  return searchFiles(accessToken, "", maxResults);
}
