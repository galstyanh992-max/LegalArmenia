-- PHASE: legal-unit chunking preview schema.
-- This migration is intentionally side-by-side: production search_chunks data is
-- not deleted or rewritten. New legal-unit chunks are written to
-- public.search_chunks_legal_unit until validation passes.

create extension if not exists vector with schema extensions;

alter table public.search_chunks
  add column if not exists source_document_id uuid,
  add column if not exists legal_unit_type text,
  add column if not exists legal_unit_number text,
  add column if not exists parent_legal_unit_id uuid,
  add column if not exists article_number text,
  add column if not exists part_number text,
  add column if not exists point_number text,
  add column if not exists paragraph_number text,
  add column if not exists legal_status text,
  add column if not exists source_date date,
  add column if not exists normalized_title text,
  add column if not exists normalized_domain text,
  add column if not exists language text,
  add column if not exists chunk_quality_flags jsonb not null default '{}'::jsonb,
  add column if not exists chunk_version text;

alter table public.search_chunks
  alter column chunk_quality_flags set default '{}'::jsonb,
  alter column chunk_version set default 'legacy_sentence_v1';

create index if not exists search_chunks_source_document_id_idx
  on public.search_chunks (source_document_id);

create index if not exists search_chunks_legal_unit_type_number_idx
  on public.search_chunks (legal_unit_type, legal_unit_number);

create index if not exists search_chunks_parent_legal_unit_id_idx
  on public.search_chunks (parent_legal_unit_id);

create index if not exists search_chunks_article_number_idx
  on public.search_chunks (article_number);

create index if not exists search_chunks_language_idx
  on public.search_chunks (language);

create index if not exists search_chunks_normalized_domain_idx
  on public.search_chunks (normalized_domain);

create index if not exists search_chunks_chunk_version_idx
  on public.search_chunks (chunk_version);

create index if not exists search_chunks_chunk_text_sha256_idx
  on public.search_chunks (chunk_text_sha256);

create index if not exists search_chunks_citation_anchor_idx
  on public.search_chunks (citation_anchor);

create index if not exists search_chunks_source_date_idx
  on public.search_chunks (source_date);

create table if not exists public.search_chunks_legal_unit (
  chunk_id uuid primary key default gen_random_uuid(),
  chunk_key text not null unique,
  source_document_id uuid not null references public.documents(document_id) on delete cascade,
  document_id uuid not null references public.documents(document_id) on delete cascade,
  version_id uuid not null references public.document_versions(version_id) on delete cascade,
  legacy_chunk_id uuid references public.search_chunks(chunk_id) on delete set null,
  legal_unit_id uuid,
  legal_unit_type text,
  legal_unit_number text,
  parent_legal_unit_id uuid,
  article_number text,
  part_number text,
  point_number text,
  paragraph_number text,
  text text not null,
  token_count integer not null,
  page_from integer,
  page_to integer,
  char_start integer not null,
  char_end integer not null,
  language text,
  language_code text,
  content_domain public.content_domain,
  normalized_domain text,
  norm_status public.normalized_status,
  legal_status text,
  effective_from date,
  effective_to date,
  source_date date,
  source_url text,
  citation_anchor text,
  normalized_title text,
  chunk_quality_flags jsonb not null default '{}'::jsonb,
  chunk_text_sha256 text not null,
  chunk_version text not null default 'legal_unit_v1',
  fts_vector tsvector generated always as (to_tsvector('simple'::regconfig, text)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_end >= char_start),
  check (chunk_version <> '')
);

create index if not exists search_chunks_legal_unit_source_document_id_idx
  on public.search_chunks_legal_unit (source_document_id);

create index if not exists search_chunks_legal_unit_document_id_idx
  on public.search_chunks_legal_unit (document_id);

create index if not exists search_chunks_legal_unit_version_id_idx
  on public.search_chunks_legal_unit (version_id);

create index if not exists search_chunks_legal_unit_legal_unit_id_idx
  on public.search_chunks_legal_unit (legal_unit_id);

create index if not exists search_chunks_legal_unit_parent_legal_unit_id_idx
  on public.search_chunks_legal_unit (parent_legal_unit_id);

create index if not exists search_chunks_legal_unit_content_domain_idx
  on public.search_chunks_legal_unit (content_domain);

create index if not exists search_chunks_legal_unit_language_idx
  on public.search_chunks_legal_unit (language);

create index if not exists search_chunks_legal_unit_effective_dates_idx
  on public.search_chunks_legal_unit (effective_from, effective_to);

create index if not exists search_chunks_legal_unit_source_date_idx
  on public.search_chunks_legal_unit (source_date);

create index if not exists search_chunks_legal_unit_hash_idx
  on public.search_chunks_legal_unit (chunk_text_sha256);

create index if not exists search_chunks_legal_unit_citation_anchor_idx
  on public.search_chunks_legal_unit (citation_anchor);

create index if not exists search_chunks_legal_unit_chunk_version_idx
  on public.search_chunks_legal_unit (chunk_version);

create index if not exists search_chunks_legal_unit_fts_idx
  on public.search_chunks_legal_unit using gin (fts_vector);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_updated_at_search_chunks_legal_unit'
      and tgrelid = 'public.search_chunks_legal_unit'::regclass
  ) then
    create trigger set_updated_at_search_chunks_legal_unit
      before update on public.search_chunks_legal_unit
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.search_chunks_legal_unit enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'search_chunks_legal_unit'
      and policyname = 'legal_unit_chunks_read'
  ) then
    create policy legal_unit_chunks_read on public.search_chunks_legal_unit
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'search_chunks_legal_unit'
      and policyname = 'legal_unit_chunks_service_write'
  ) then
    create policy legal_unit_chunks_service_write on public.search_chunks_legal_unit
      for all to service_role using (true) with check (true);
  end if;
end $$;

grant select on public.search_chunks_legal_unit to authenticated;
grant all on public.search_chunks_legal_unit to service_role;

create table if not exists public.search_chunks_legal_unit_embeddings (
  embedding_id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.search_chunks_legal_unit(chunk_id) on delete cascade,
  chunk_text_sha256 text not null,
  provider text not null,
  model text not null,
  dimension integer not null,
  embedding vector(1024),
  status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chunk_id, model),
  check (dimension = 1024),
  check (status in ('success', 'failed', 'skipped'))
);

create index if not exists search_chunks_legal_unit_embeddings_chunk_idx
  on public.search_chunks_legal_unit_embeddings (chunk_id);

create index if not exists search_chunks_legal_unit_embeddings_model_idx
  on public.search_chunks_legal_unit_embeddings (model);

create index if not exists search_chunks_legal_unit_embeddings_hash_idx
  on public.search_chunks_legal_unit_embeddings (chunk_text_sha256);

create index if not exists search_chunks_legal_unit_embeddings_vector_idx
  on public.search_chunks_legal_unit_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where status = 'success' and embedding is not null;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_updated_at_search_chunks_legal_unit_embeddings'
      and tgrelid = 'public.search_chunks_legal_unit_embeddings'::regclass
  ) then
    create trigger set_updated_at_search_chunks_legal_unit_embeddings
      before update on public.search_chunks_legal_unit_embeddings
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.search_chunks_legal_unit_embeddings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'search_chunks_legal_unit_embeddings'
      and policyname = 'legal_unit_embeddings_service_only'
  ) then
    create policy legal_unit_embeddings_service_only
      on public.search_chunks_legal_unit_embeddings
      for all to service_role using (true) with check (true);
  end if;
end $$;

grant all on public.search_chunks_legal_unit_embeddings to service_role;

create or replace function public.search_legal_unit_chunks_preview(
  p_query_text text,
  p_limit integer default 10,
  p_content_domain public.content_domain default null,
  p_language text default null,
  p_effective_at date default null
) returns table (
  chunk_id uuid,
  document_id uuid,
  version_id uuid,
  title text,
  text_snippet text,
  source_url text,
  citation_anchor text,
  language text,
  content_domain public.content_domain,
  norm_status public.normalized_status,
  legal_unit_id uuid,
  article_number text,
  chunk_version text,
  score real
)
language sql
stable
security definer
set search_path = public
as $$
  with tokens as (
    select distinct lower(token) as token
    from regexp_split_to_table(coalesce(p_query_text, ''), '[^[:alnum:]Ա-Ֆա-ֆև]+') token
    where length(token) >= 3
  ),
  scored as (
    select
      sc.*,
      coalesce(sum(
        case
          when lower(coalesce(sc.normalized_title, '')) like '%' || t.token || '%' then 3
          when lower(coalesce(sc.citation_anchor, '')) like '%' || t.token || '%' then 2
          when lower(sc.text) like '%' || t.token || '%' then 1
          else 0
        end
      ), 0)::real as lexical_score
    from public.search_chunks_legal_unit sc
    cross join tokens t
    where p_query_text is not null
      and p_query_text <> ''
      and (p_content_domain is null or sc.content_domain = p_content_domain)
      and (p_language is null or sc.language = p_language or sc.language_code = p_language)
      and (sc.norm_status is null or sc.norm_status = 'active'::public.normalized_status)
      and (p_effective_at is null or sc.effective_from is null or sc.effective_from <= p_effective_at)
      and (p_effective_at is null or sc.effective_to is null or sc.effective_to > p_effective_at)
      and (
        lower(coalesce(sc.normalized_title, '')) like '%' || t.token || '%'
        or lower(coalesce(sc.citation_anchor, '')) like '%' || t.token || '%'
        or lower(sc.text) like '%' || t.token || '%'
      )
    group by sc.chunk_id
  )
  select
    scored.chunk_id,
    scored.document_id,
    scored.version_id,
    scored.normalized_title as title,
    left(scored.text, 1200) as text_snippet,
    scored.source_url,
    scored.citation_anchor,
    scored.language,
    scored.content_domain,
    scored.norm_status,
    scored.legal_unit_id,
    scored.article_number,
    scored.chunk_version,
    scored.lexical_score as score
  from public.search_chunks_legal_unit sc
  join scored on scored.chunk_id = sc.chunk_id
  order by scored.lexical_score desc, scored.chunk_id
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

grant execute on function public.search_legal_unit_chunks_preview(
  text, integer, public.content_domain, text, date
) to authenticated, service_role;
