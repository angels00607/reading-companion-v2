-- Keep server-side StoryGraph deduplication aligned with the client preview.
-- Do not overwrite any existing books or touch DLV tables.
do $migration$
declare definition text;
begin
 definition := pg_get_functiondef('public.rc_import_storygraph(jsonb)'::regprocedure);
 if position('and (v_isbn13 is null and v_isbn10 is null or b.isbn_13 is null and b.isbn_10 is null)' in definition)=0 then
  raise exception 'Expected StoryGraph duplicate predicate not found';
 end if;
 definition := replace(definition,
  'and (v_isbn13 is null and v_isbn10 is null or b.isbn_13 is null and b.isbn_10 is null)',
  '');
 execute definition;
end
$migration$;
