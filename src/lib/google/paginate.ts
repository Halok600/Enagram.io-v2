export type Page<T> = { items: T[]; nextPageToken?: string | null };

/**
 * Follows `nextPageToken` for at most `maxPages` pages. `truncated` is true when
 * the cap was hit while Google still had more: the caller must then treat the
 * result as a partial list, never as a complete window.
 */
export async function collectPages<T>(
  fetchPage: (pageToken?: string) => Promise<Page<T>>,
  maxPages: number,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let token: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(token);
    items.push(...res.items);
    if (!res.nextPageToken) return { items, truncated: false };
    token = res.nextPageToken;
  }
  return { items, truncated: true };
}
