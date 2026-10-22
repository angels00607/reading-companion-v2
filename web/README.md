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
