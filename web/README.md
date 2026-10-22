# Reading Companion Web

Personal, installable React/Vite web app deployed to GitHub Pages. Supabase authentication and row-level security keep each user's library separate.

## Local development
```sh
cd web
npm install
npm test
npm run build
npm run dev
```

Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put a Supabase service-role key in the browser.

## StoryGraph CSV import
1. Export your library from StoryGraph as CSV.
2. Upload the CSV on the Import screen. Parsing happens locally; the preview flags unknown statuses, invalid dates, incomplete rereads, duplicate periods and fractional ratings.
3. Review or correct excluded entries. Book formats are **never inferred** from StoryGraph; choose them manually.
4. Confirm the preview explicitly, then import. The app calls the authenticated `rc_import_storygraph` database function once. All books and reading sessions are saved in **one transaction**; an error rolls back the whole import.
5. Existing books are skipped when the database identifies a matching ISBN or matching title/author without identifiers. The response reports added books, sessions and skipped books.

No import is performed automatically. DNF books remain in the library but do not count toward completed-reading statistics. Incomplete rereads are not invented.

The parser regression tests run in GitHub Actions before deployment. They use synthetic fixtures, not the owner's personal CSV.

## Known limitations
- No offline editing or sophisticated conflict resolution.
- StoryGraph may not provide dates for every reread; those sessions must be completed manually.
- Apple SwiftUI project is a separate early prototype. The supported personal experience is the Web/PWA app.
- GitHub Actions checks compilation and parser tests; manual end-to-end testing of the authenticated import is still needed before importing a real library.

## Reading challenges (Phase 4)

Seven challenge views: Alphabet (26 letters), Around the World (20 verified cities), Tropes (20 prompts), Archetypes (20 positions), Monthly (36 prompts), Seasonal (20 prompts) and Reading Roulette (10 mechanisms).

Version A applies to even years from 2020 and Version B to odd years. Eligibility uses dated completed reading sessions when available, so a reread may count in its actual completion year. DNF and currently-reading books do not qualify. Monthly and seasonal challenges use the actual session completion month. Challenge matches (city, trope, archetype, prompt) require the reader's confirmation; the app does not infer them.

**Known content gap:** Archetypes B position 10 is intentionally empty, and positions 12–20 require the user's original prompt wording. They are not auto-generated. Automated challenge rules tests run before Web deployment. End-to-end assignment/removal tests with an authenticated account remain necessary before calling the challenge workflow fully verified.

## Gamification (Phase 5)

The Home view displays seven derived lifetime achievements and three monthly quests. Monthly quests renew by the local calendar month and derive their progress from saved completed readings; they require no scheduled jobs or additional database tables. DNF books are excluded, rereads count as dated completions, and missing page counts are not estimated. Five regression tests cover milestone counts, rereads, DNF exclusion and monthly rollover.

**Release alerts:** The Home view can request browser notification permission, but this is only permission setup. Automated alerts about new book releases are **not implemented**: there is no verified release-date feed, backend scheduler or push subscription. The UI states this limitation explicitly and does not claim to send alerts. Browser permission alone does not provide background push notifications.

### Release reminders (follow-up)

The user may manually enter a verified publication date for a To Read book. Supabase stores `rc_books.release_on` and `rc_books.release_alert_enabled` under existing book RLS. When notification permission is granted, the open Web app checks due reminders on mount, data refresh and every minute, displaying a browser Notification once per book per local release day. A user-specific localStorage key prevents repeat notifications on the same browser. Removing a reminder clears both fields. Dates are not guessed or automatically imported.

**Limitations:** This is an in-app/open-tab browser notification, not Web Push. It does not run with the app closed, does not sync delivery state between devices, and requires browser permission. Background delivery would need service-worker Push subscriptions, VAPID keys, a secure server-side sender and scheduled publication-date checks. Test manually in a signed-in browser with a verified date before claiming end-to-end validation.

### Publication date lookup

The release reminder editor now offers a Google Books search using ISBN when known, or title/author otherwise. Only exact valid YYYY-MM-DD dates are offered, and the user must review the matching edition/publisher and explicitly select/save a date. Partial dates and mismatched titles are not silently converted into release days. Google Books metadata can refer to an earlier edition and is not a guaranteed upcoming-release feed. This feature requires network access to Google's Books API.

**Background notifications remain unimplemented.** iOS Home Screen web push requires an installed PWA, service worker, Push API subscription and server-side scheduled delivery; this is separate from open-page browser notifications. No push is claimed to be active.

### Web Push groundwork

A service worker is now served at `/reading-companion-v2/sw.js` and registered under the same GitHub Pages scope. It can display a browser push event and open/focus Reading Companion when tapped. iPhone users are shown Add to Home Screen instructions when the app is not installed. **This does not create push subscriptions or deliver messages**: a VAPID public key, per-device subscriptions, RLS-protected subscription storage, scheduled server-side sender and deduplication still need to be implemented and tested. Do not expose VAPID private keys or service-role credentials in the web bundle. Browser notification permission by itself is not a Push API subscription.

### Secure push subscription groundwork

The database now has `public.rc_push_subscriptions` (user-owned endpoint and subscription keys) with RLS and four owner-scoped policies. The Home screen includes explicit per-device subscribe/unsubscribe actions. Subscription is disabled until `VITE_VAPID_PUBLIC_KEY` is configured for the Web build. The public key may be in the client; the **private VAPID key must never be committed or exposed**. Device records are stored only after explicit permission, and unsubscribe removes the database record and browser subscription. Existing app-open reminders remain available independently.

**Not production-ready yet:** A server-side push sender, VAPID private key in secure server secrets, an authenticated scheduled trigger, date/timezone handling, delivery logs, invalid-endpoint cleanup and end-to-end iPhone testing are still required. Merely saving a subscription does not send notifications. No server sender or scheduler has been enabled.

### Release Push sender — server setup required

A protected delivery queue `rc_release_delivery_log` now tracks per-book, per-device, per-release-date attempts. RLS is enabled, client access is revoked, and `rc_queue_release_notifications(date)` can only be called with the service role. The sender source is in `supabase/functions/send-release-push/index.ts` and checks a dedicated `RELEASE_PUSH_JOB_SECRET` on every request. It uses server-only `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`. Never place these private values in GitHub Pages or the browser. Set the matching **public** VAPID key as `VITE_VAPID_PUBLIC_KEY` in the Web build environment.

**The Edge Function is deployed but sending and scheduling are not configured yet.** JWT verification is disabled only because the function implements its own secret header check; without RELEASE_PUSH_JOB_SECRET, requests are rejected. Arrange an authenticated server-to-server daily POST with `Authorization: Bearer <RELEASE_PUSH_JOB_SECRET>`. The current sender uses the UTC date; timezone-aware scheduling, reliable multi-worker job claiming and authenticated end-to-end device testing are required before relying on notifications. Do not claim background alerts are operational until those checks pass.

### Scheduled sender activation checklist (2026-10)

The Supabase Edge Function `send-release-push` is deployed as version 2 and uses the Europe/Zurich calendar date. Delivery jobs are claimed atomically via service-only `rc_claim_release_deliveries` to reduce duplicate concurrent sends. GitHub Actions `.github/workflows/release-push.yml` is scheduled for 07:15 UTC daily (08:15/09:15 in Switzerland depending on DST). The workflow is a safe no-op until the GitHub Actions repository secret `RELEASE_PUSH_JOB_SECRET` is configured with the same high-entropy value as the Supabase Edge Function secret. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on the Supabase function and the matching public `VITE_VAPID_PUBLIC_KEY` in the Web build before enabling. **Do not reuse or publish private keys or send them in chat.** These secrets were not configured during this change. The sender remains inactive without them. Verify actual push delivery on an installed iPhone Home Screen PWA before relying on alerts.

### Activate push without exposing secrets

1. In Supabase → Edge Functions → Secrets, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for example a mailto: address) and a long random `RELEASE_PUSH_JOB_SECRET`.
2. In GitHub → repository Settings → Secrets and variables → Actions, set the **secret** `RELEASE_PUSH_JOB_SECRET` to the identical job-secret value. Add `VITE_VAPID_PUBLIC_KEY` as a **repository variable** (not a secret) containing the matching public VAPID key. The Web build now reads this variable.
3. Re-run **Deploy Reading Companion Web** to publish the public key. Install the PWA on the iPhone Home Screen and explicitly register the device in release reminders.
4. Run **Send release push reminders** manually to validate the server response before relying on its daily schedule. Test a legitimate due release on a device; never edit another user's records or use production dates for an artificial test.

The scheduler is UTC 07:15 every day. It is deliberately inert when the job secret is absent. Only public VAPID material belongs in the browser. The deployment cannot be fully activated from this session without secure secret configuration and a real device test.
