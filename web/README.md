# Reading Companion Web
Simple Vite + React installable web app. Uses the existing DLV Supabase project but only the isolated public.rc_books table, protected by per-user RLS.

Environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (publishable key only; never use service_role).

Run npm install && npm run build. Deploy web/ to Vercel with framework Vite and output directory dist. iPhone: Safari > Share > Add to Home Screen. Mac: Safari > File > Add to Dock.

Current limitations: no offline editing, no conflict resolution, and Journal/Challenges/Statistics not implemented. Changes saved online are visible on both devices after opening or tapping Sync.
