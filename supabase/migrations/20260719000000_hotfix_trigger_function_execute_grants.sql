BEGIN;

REVOKE EXECUTE
ON FUNCTION public.cases_compat_insert()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

COMMIT;