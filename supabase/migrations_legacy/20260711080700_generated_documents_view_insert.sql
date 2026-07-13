-- P1: document generation never saved. public.generated_documents is a view
-- with computed columns and had no INSTEAD OF INSERT trigger, so every insert
-- from useDocumentGenerator / CaseComplaintGenerator / GenerateComplaintButton
-- failed. Map the app-facing columns onto app.generated_documents, packing
-- fields without base columns into metadata. Standalone (no-case) documents
-- are a real app feature (MyDocuments), so case_id becomes nullable and the
-- base insert policy allows any case member / standalone owner.

alter table app.generated_documents alter column case_id drop not null;

drop policy if exists gd_insert on app.generated_documents;
create policy gd_insert on app.generated_documents
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (case_id is null or app.can_read_case(case_id))
  );

create or replace function public.generated_documents_view_insert()
returns trigger
language plpgsql
set search_path = public, app
as $$
begin
  insert into app.generated_documents (case_id, created_by, template, content, metadata)
  values (
    new.case_id,
    coalesce(new.user_id, auth.uid()),
    coalesce(new.title, new.document_type, 'document'),
    coalesce(new.content, new.content_text),
    coalesce(new.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'template_id', new.template_id,
      'status', new.status,
      'document_type', new.document_type,
      'recipient_name', new.recipient_name,
      'recipient_position', new.recipient_position,
      'recipient_organization', new.recipient_organization,
      'sender_name', new.sender_name,
      'sender_address', new.sender_address,
      'sender_contact', new.sender_contact,
      'source_text', new.source_text
    ))
  )
  returning generated_id, created_at, updated_at
    into new.id, new.created_at, new.updated_at;
  return new;
end;
$$;

drop trigger if exists generated_documents_insert_tg on public.generated_documents;
create trigger generated_documents_insert_tg
instead of insert on public.generated_documents
for each row execute function public.generated_documents_view_insert();
