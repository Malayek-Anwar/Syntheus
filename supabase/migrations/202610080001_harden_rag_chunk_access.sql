-- Syntheus V1 Phase 1: RAG retrieval boundary + personal chunk owner writes.
-- Institutional document_chunks intentionally remain unreadable directly by students.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_active_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = (select auth.uid())
      and s.account_status = 'active'::public.account_status
  );
$$;

revoke all on function private.is_active_student() from public, anon;
grant execute on function private.is_active_student() to authenticated;

create or replace function private.student_matches_target(
  target_departments text[],
  target_semesters smallint[],
  target_sections text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    where s.id = (select auth.uid())
      and s.account_status = 'active'::public.account_status
      and (
        coalesce(cardinality(target_departments), 0) = 0
        or 'ALL' = any(array(
          select upper(btrim(value))
          from unnest(target_departments) as target(value)
        ))
        or (
          s.department is not null
          and upper(btrim(s.department)) = any(array(
            select upper(btrim(value))
            from unnest(target_departments) as target(value)
          ))
        )
      )
      and (
        coalesce(cardinality(target_semesters), 0) = 0
        or s.semester = any(target_semesters)
      )
      and (
        coalesce(cardinality(target_sections), 0) = 0
        or 'ALL' = any(array(
          select upper(btrim(value))
          from unnest(target_sections) as target(value)
        ))
        or (
          s.section is not null
          and upper(btrim(s.section)) = any(array(
            select upper(btrim(value))
            from unnest(target_sections) as target(value)
          ))
        )
      )
  );
$$;

revoke all on function private.student_matches_target(text[], smallint[], text[]) from public, anon;
grant execute on function private.student_matches_target(text[], smallint[], text[]) to authenticated;

alter table public.document_chunks enable row level security;
revoke all on public.document_chunks from anon;
grant select, insert, update, delete on public.document_chunks to authenticated;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document_chunks'
  loop
    execute format('drop policy if exists %I on public.document_chunks', policy_name);
  end loop;
end;
$$;

create policy "Admins can manage document chunks"
on public.document_chunks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.personal_document_chunks enable row level security;
revoke all on public.personal_document_chunks from anon;
grant select, insert, update, delete on public.personal_document_chunks to authenticated;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_document_chunks'
  loop
    execute format('drop policy if exists %I on public.personal_document_chunks', policy_name);
  end loop;
end;
$$;

create policy "personal_document_chunks_select_owner"
on public.personal_document_chunks
for select
to authenticated
using (
  (select private.is_active_student())
  and exists (
    select 1 from public.personal_documents pd
    where pd.id = personal_document_chunks.personal_document_id
      and pd.student_id = (select auth.uid())
  )
);

drop policy if exists "personal_document_chunks_insert_owner" on public.personal_document_chunks;

create policy "personal_document_chunks_insert_owner"
on public.personal_document_chunks
for insert
to authenticated
with check (
  (select private.is_active_student())
  and
  exists (
    select 1 from public.personal_documents pd
    where pd.id = personal_document_chunks.personal_document_id
      and pd.student_id = (select auth.uid())
  )
);

drop policy if exists "personal_document_chunks_update_owner" on public.personal_document_chunks;

create policy "personal_document_chunks_update_owner"
on public.personal_document_chunks
for update
to authenticated
using (
  (select private.is_active_student())
  and
  exists (
    select 1 from public.personal_documents pd
    where pd.id = personal_document_chunks.personal_document_id
      and pd.student_id = (select auth.uid())
  )
)
with check (
  (select private.is_active_student())
  and
  exists (
    select 1 from public.personal_documents pd
    where pd.id = personal_document_chunks.personal_document_id
      and pd.student_id = (select auth.uid())
  )
);

drop policy if exists "personal_document_chunks_delete_owner" on public.personal_document_chunks;

create policy "personal_document_chunks_delete_owner"
on public.personal_document_chunks
for delete
to authenticated
using (
  (select private.is_active_student())
  and
  exists (
    select 1 from public.personal_documents pd
    where pd.id = personal_document_chunks.personal_document_id
      and pd.student_id = (select auth.uid())
  )
);

create or replace function public.match_student_institutional_chunks(
  query_text text,
  query_embedding extensions.vector(384),
  match_count integer default 8,
  include_archived boolean default false
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  source_title text,
  similarity double precision,
  rrf_score double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_chunks as (
    select c.id, c.document_id, c.chunk_index, c.content,
           d.title as source_title, c.embedding, c.search_vector
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where (select private.is_active_student())
      and (
        (d.status = 'published'::public.document_status
         and (d.expires_at is null or d.expires_at > now()))
        or (include_archived and d.status = 'archived'::public.document_status)
      )
      and (select private.student_matches_target(
        d.target_departments, d.target_semesters, d.target_sections))
  ),
  semantic as (
    select ec.id, row_number() over (
      order by ec.embedding OPERATOR(extensions.<=>) query_embedding) as rank_ix
    from eligible_chunks ec
    order by ec.embedding OPERATOR(extensions.<=>) query_embedding
    limit least(greatest(match_count, 1), 30) * 3
  ),
  keyword as (
    select ec.id, row_number() over (
      order by ts_rank_cd(ec.search_vector,
        websearch_to_tsquery('english', coalesce(query_text, ''))) desc) as rank_ix
    from eligible_chunks ec
    where ec.search_vector @@ websearch_to_tsquery(
      'english', coalesce(query_text, ''))
    order by rank_ix
    limit least(greatest(match_count, 1), 30) * 3
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (50 + s.rank_ix), 0.0)
           + coalesce(1.0 / (50 + k.rank_ix), 0.0) as rrf_score
    from semantic s full outer join keyword k on k.id = s.id
  )
  select ec.id, ec.document_id, ec.chunk_index, ec.content, ec.source_title,
         1 - (ec.embedding OPERATOR(extensions.<=>) query_embedding) as similarity,
         fused.rrf_score
  from fused join eligible_chunks ec on ec.id = fused.id
  order by fused.rrf_score desc
  limit least(greatest(match_count, 1), 30);
$$;

revoke execute on function public.match_student_institutional_chunks(text, extensions.vector, integer, boolean)
from public, anon;
grant execute on function public.match_student_institutional_chunks(text, extensions.vector, integer, boolean)
to authenticated;

create or replace function public.match_student_personal_chunks(
  query_text text,
  query_embedding extensions.vector(384),
  match_count integer default 8
)
returns table (
  id uuid,
  personal_document_id uuid,
  chunk_index integer,
  content text,
  source_title text,
  similarity double precision,
  rrf_score double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_chunks as (
    select pc.id, pc.personal_document_id, pc.chunk_index, pc.content,
           pd.title as source_title, pc.embedding, pc.search_vector
    from public.personal_document_chunks pc
    join public.personal_documents pd on pd.id = pc.personal_document_id
    where (select private.is_active_student())
      and pd.student_id = (select auth.uid())
      and pd.status = 'ready'::public.personal_document_status
  ),
  semantic as (
    select ec.id, row_number() over (
      order by ec.embedding OPERATOR(extensions.<=>) query_embedding) as rank_ix
    from eligible_chunks ec
    order by ec.embedding OPERATOR(extensions.<=>) query_embedding
    limit least(greatest(match_count, 1), 30) * 3
  ),
  keyword as (
    select ec.id, row_number() over (
      order by ts_rank_cd(ec.search_vector,
        websearch_to_tsquery('english', coalesce(query_text, ''))) desc) as rank_ix
    from eligible_chunks ec
    where ec.search_vector @@ websearch_to_tsquery(
      'english', coalesce(query_text, ''))
    order by rank_ix
    limit least(greatest(match_count, 1), 30) * 3
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (50 + s.rank_ix), 0.0)
           + coalesce(1.0 / (50 + k.rank_ix), 0.0) as rrf_score
    from semantic s full outer join keyword k on k.id = s.id
  )
  select ec.id, ec.personal_document_id, ec.chunk_index, ec.content, ec.source_title,
         1 - (ec.embedding OPERATOR(extensions.<=>) query_embedding) as similarity,
         fused.rrf_score
  from fused join eligible_chunks ec on ec.id = fused.id
  order by fused.rrf_score desc
  limit least(greatest(match_count, 1), 30);
$$;

revoke execute on function public.match_student_personal_chunks(text, extensions.vector, integer)
from public, anon;
grant execute on function public.match_student_personal_chunks(text, extensions.vector, integer)
to authenticated;

revoke execute on function public.match_document_chunks(extensions.vector, integer, uuid[])
from public, anon, authenticated;
revoke execute on function public.match_personal_document_chunks(extensions.vector, uuid, integer, uuid[])
from public, anon, authenticated;
revoke execute on function public.match_documents_hybrid(extensions.vector, text, text, integer, integer, integer)
from public, anon, authenticated;
