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
