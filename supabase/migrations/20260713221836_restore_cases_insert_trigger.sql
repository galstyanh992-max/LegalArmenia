-- Restore the application-contract INSERT path for the public cases view.
-- The function is part of the versioned baseline; only its missing trigger is
-- added here so authenticated lawyers/admins do not write through the view
-- directly into the RLS-protected app.cases table.

create trigger cases_insert_tg
instead of insert on public.cases
for each row execute function public.cases_compat_insert();
