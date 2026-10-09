# Pre-demo checklist (about 2 minutes)

Do this a few minutes before showing the project. Each step says what a failure
means and the one fix.

1. **Open `https://enagram-io.vercel.app/api/health`.**
   Expect `{"db":"ok", "documents": <number>, ...}`.
   - `"db":"down"` with `"reason":"paused"` → Supabase paused the project. Open the
     Supabase dashboard, press **Restore**, wait ~2 minutes, reload this URL.
   - `"reason":"not_configured"` → `DATABASE_URL` is missing in Vercel → add it and redeploy.
   - `"reason":"timeout"` or `"unreachable"` → wait a minute and reload; if it persists,
     check Supabase status and the Vercel logs.

2. **Open the app and sign in with Google.**
   - "Access blocked" or a repeated login prompt after about a week → the Google OAuth
     app is in *Testing* mode, which expires logins every 7 days. Sign in again (works
     immediately). To stop it recurring: Google Cloud Console → OAuth consent screen →
     **Publish app** (it will show an "unverified app" warning on the sign-in screen;
     that is expected for a personal project). **Do this only AFTER setting
     `ALLOWED_EMAILS` in Vercel** to your own Google address (and redeploying): this
     app reads one shared database, so once the OAuth app is published any Google
     account could otherwise sign in and read your mail through the chat.
   - NextAuth's "AccessDenied" page after signing in → you used a Google account that is
     not listed in `ALLOWED_EMAILS`. Sign in with the owner account. `ALLOWED_EMAILS` is
     set in Vercel; unset or empty = unrestricted; any other value with no valid entries (for
     example `,` or only spaces) = nobody can sign in.
   - A red banner at the top of the chat → read it; it names the problem and the fix.

3. **Press Sync now.** Expect "N email(s) + N file(s) + N event(s) → N document(s)".
   - An error mentioning quota → Gmail rate-limited you; wait a minute and press again.
   - "Search by meaning is still catching up (some documents are not indexed yet)" → the sync
     ran out of rounds or the embedding service was slow; keyword search already works;
     press Sync again in a minute.

4. **Ask two questions:** "What was the last email about an interview?" and "What's on my calendar
   this week?" Each should answer within ~30 seconds with sources.
   - If an answer says it ran out of time, ask a narrower question (name the sender
     or subject).

5. **Ask it to save a preference** ("remember that I prefer short replies"). An Approve / Deny
   card must appear and nothing is saved yet; **Deny** does nothing, **Approve** saves it.
   - No card and it saved straight away: the approval policy is not active; check the
     deployed build includes `TOOL_APPROVAL_POLICY` in `src/app/api/chat/route.ts`.
   - Approve is followed by an error about an approval signature: `TOOL_APPROVAL_SECRET` differs
     between instances or changed mid-conversation; set one value in Vercel, redeploy, and ask again.

6. **Optional but recommended:** record a 60-second screen capture of steps 2-4 working
   and link it from the README, as a fallback if the live site is ever unavailable
   during an interview.

If something is wrong and the cause is unclear, open `/api/diagnose` while signed in:
it times the database, keyword search, the embedding call and vector search so the
slow or failing layer is obvious.
