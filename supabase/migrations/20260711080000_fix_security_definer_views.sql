-- P0: public.cases and public.generated_documents were owner-rights views
-- (no security_invoker), so any authenticated user bypassed app-schema RLS
-- and could read every case / generated document. Flip them to
-- security_invoker so base-table RLS applies to the querying user.
alter view public.cases set (security_invoker = on);
alter view public.generated_documents set (security_invoker = on);
