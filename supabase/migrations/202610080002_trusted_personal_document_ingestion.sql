-- Students may submit personal document metadata, but only trusted server code
-- may create chunks or transition a document from processing to ready.

alter table public.personal_documents enable row level security;
revoke all on public.personal_documents from public, anon, authenticated;
grant select, insert, delete on public.personal_documents to authenticated;
grant all on public.personal_documents to service_role;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_documents'
  loop
    execute format('drop policy if exists %I on public.personal_documents', policy_name);
  end loop;
end;
$$;

create policy "personal_documents_select_owner"
on public.personal_documents
for select
to authenticated
using (
  (select private.is_active_student())
  and student_id = (select auth.uid())
);

create policy "personal_documents_insert_processing_owner"
on public.personal_documents
for insert
to authenticated
with check (
  (select private.is_active_student())
  and student_id = (select auth.uid())
  and status = 'processing'::public.personal_document_status
);

create policy "personal_documents_delete_owner"
on public.personal_documents
for delete
to authenticated
using (
  (select private.is_active_student())
  and student_id = (select auth.uid())
);

alter table public.personal_document_chunks enable row level security;
revoke all on public.personal_document_chunks from public, anon, authenticated;
grant select on public.personal_document_chunks to authenticated;
grant all on public.personal_document_chunks to service_role;

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
    select 1
    from public.personal_documents pd
    where pd.id = personal_document_chunks.personal_document_id
      and pd.student_id = (select auth.uid())
  )
);
