# Reading Companion V3 — isolated Supabase migration

This branch (`v3-supabase-migration`) is an isolated test candidate. The `main` branch and published GitHub Pages V2 remain unchanged.

## Configuration

- Supabase project: `qpkliwzcfhyyifmvuygh` (Reading Companion)
- Client uses the project's public publishable key. Never embed a service-role or secret key in browser code.
- Bundled app: `assets/index-CHNuUCFh.js`; `index.html` references this bundle.
- This repository currently contains prebuilt assets. For maintainable V3 development, restore or introduce the original source/build workflow before making substantial UI changes.

## Database readiness

- 14 `rc_*` tables with RLS enabled.
- 1,807 imported records associated with the new account: 704 books, 547 sessions, 20 custom prompts, 536 not-interested entries.
- Source and target matched for 113 columns, 100 constraints, 44 indexes and 3 triggers as of 2026-10-28.
- Push subscriptions and release delivery log are not migrated; re-register and configure push notifications separately.

## Before switching production

1. Publish a separate test deployment for this branch (do not switch GitHub Pages production to this branch).
2. Sign in with the new Reading Companion account and test all library and challenge operations.
3. Verify RLS using an authenticated session and confirm unauthorized users cannot read or modify data.
4. Reconfigure push notification backend and subscriptions; verify scheduled notifications.
5. Reconcile final data changes made in V2 after the initial migration to prevent data loss.
6. Switch production only after explicit approval and successful tests; retain DLV source until approved for deletion.

Do not merge this branch into `main` before the cutover is approved.
