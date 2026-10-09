/** True only for absolute http(s) URLs, so a source can never render as a javascript: or data: link. */
export function isHttpUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}
