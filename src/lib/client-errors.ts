/** The chat route returns JSON error bodies; an expired Google session is the one case with a clear user action. */
export function friendlyClientError(message: string): string {
  if (/RefreshAccessTokenError|MissingRefreshToken|Not authenticated/i.test(message)) {
    return "Your Google session has expired. Press Disconnect, then connect your Google account again.";
  }
  if (/not allowed to use this app/i.test(message)) {
    return "This Google account is not allowed to use this app. Press Disconnect and sign in with the owner account.";
  }
  return message;
}
