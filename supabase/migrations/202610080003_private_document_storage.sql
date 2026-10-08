-- Private PDF buckets with server/database-backed storage authorization.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('institutional-documents', 'institutional-documents', false, 26214400, array['application/pdf']),
  ('personal-documents', 'personal-documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "institutional_pdf_select_authorized" on storage.objects;
create policy "institutional_pdf_select_authorized"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'institutional-documents'
  and exists (
    select 1
    from public.documents d
    where d.storage_bucket = 'institutional-documents'
      and d.storage_path = storage.objects.name
      and (
        exists (
          select 1
          from public.admins a
          where a.id = (select auth.uid())
        )
        or (
          (d.status = 'published'::public.document_status
            and (d.expires_at is null or d.expires_at > now())
            or d.status = 'archived'::public.document_status)
          and (select private.is_active_student())
          and (select private.student_matches_target(
            d.target_departments,
            d.target_semesters,
            d.target_sections
          ))
        )
      )
  )
);

drop policy if exists "institutional_pdf_insert_processing_admin" on storage.objects;
create policy "institutional_pdf_insert_processing_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'institutional-documents'
  and exists (
    select 1
    from public.admins a
    join public.documents d on d.uploaded_by = a.id
    where a.id = (select auth.uid())
      and d.storage_bucket = 'institutional-documents'
      and d.storage_path = storage.objects.name
      and d.status = 'processing'::public.document_status
  )
);

drop policy if exists "institutional_pdf_delete_admin" on storage.objects;
create policy "institutional_pdf_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'institutional-documents'
  and exists (
    select 1
    from public.admins a
    where a.id = (select auth.uid())
  )
);

drop policy if exists "personal_pdf_select_owner" on storage.objects;
create policy "personal_pdf_select_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'personal-documents'
  and (select private.is_active_student())
  and exists (
    select 1
    from public.personal_documents pd
    where pd.student_id = (select auth.uid())
      and pd.storage_bucket = 'personal-documents'
      and pd.storage_path = storage.objects.name
      and pd.storage_path like (select auth.uid())::text || '/%'
  )
);

drop policy if exists "personal_pdf_insert_processing_owner" on storage.objects;
create policy "personal_pdf_insert_processing_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'personal-documents'
  and (select private.is_active_student())
  and (storage.objects.name like (select auth.uid())::text || '/%')
  and exists (
    select 1
    from public.personal_documents pd
    where pd.student_id = (select auth.uid())
      and pd.storage_bucket = 'personal-documents'
      and pd.storage_path = storage.objects.name
      and pd.status = 'processing'::public.personal_document_status
  )
);

drop policy if exists "personal_pdf_delete_owner" on storage.objects;
create policy "personal_pdf_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'personal-documents'
  and (select private.is_active_student())
  and (storage.objects.name like (select auth.uid())::text || '/%')
);
