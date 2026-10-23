-- Archive of books explicitly declined on StoryGraph; never treated as reading DNF.
-- Apply this migration to the Supabase project actually used by Reading Companion V2.
create table if not exists public.rc_not_interested (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 author text not null default '',
 isbn_13 text,
 isbn_10 text,
 source text not null default 'storygraph',
 created_at timestamptz not null default now(),
 constraint rc_not_interested_title_nonempty check (length(trim(title)) > 0)
);
create unique index if not exists rc_not_interested_user_isbn13
 on public.rc_not_interested (user_id, isbn_13) where isbn_13 is not null;
create unique index if not exists rc_not_interested_user_isbn10
 on public.rc_not_interested (user_id, isbn_10) where isbn_10 is not null;
alter table public.rc_not_interested enable row level security;
create policy "Read own excluded books" on public.rc_not_interested
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own excluded books" on public.rc_not_interested
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Delete own excluded books" on public.rc_not_interested
 for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.rc_not_interested to authenticated;
