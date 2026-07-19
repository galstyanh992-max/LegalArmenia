BEGIN;

GRANT EXECUTE
ON FUNCTION public.cases_compat_insert()
TO PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO PUBLIC, anon, authenticated;

COMMIT;