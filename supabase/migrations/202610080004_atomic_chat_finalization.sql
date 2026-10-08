-- Preserve message source-title snapshots after the referenced document is deleted.
alter table public.message_sources
  drop constraint if exists message_sources_check;

alter table public.message_sources
  drop constraint if exists message_sources_source_reference_check;

alter table public.message_sources
  add constraint message_sources_source_reference_check
  check (
    (document_id is not null and personal_document_id is null)
    or (document_id is null and personal_document_id is not null)
    or (document_id is null and personal_document_id is null)
  );

create or replace function public.finalize_student_chat_response(
  p_conversation_id uuid,
  p_assistant_message_id uuid,
  p_content text,
  p_sources jsonb,
  p_include_archived boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_conversation_student_id uuid;
  v_requested_source_count integer;
  v_authorized_source_count integer;
begin
  select s.id
  into v_student_id
  from public.students s
  where s.id = (select auth.uid())
    and s.account_status = 'active'::public.account_status
  for share;

  if not found then
    raise exception 'An active student session is required';
  end if;

  if p_assistant_message_id is null then
    raise exception 'Assistant message ID is required';
  end if;
  if nullif(btrim(p_content), '') is null then
    raise exception 'Assistant response content is required';
  end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' then
    raise exception 'Message sources must be a JSON array';
  end if;

  select c.student_id
  into v_conversation_student_id
  from public.chat_conversations c
  where c.id = p_conversation_id
  for update;

  if not found or v_conversation_student_id <> v_student_id then
    raise exception 'Conversation not found or not owned by the active student';
  end if;

  with requested as (
    select distinct input.source_id, input.source_type
    from jsonb_to_recordset(p_sources) as input(source_id uuid, source_type text)
  )
  select count(*)::integer
  into v_requested_source_count
  from requested;

  perform 1
  from jsonb_to_recordset(p_sources) as input(source_id uuid, source_type text)
  join public.document_chunks chunk
    on chunk.id = input.source_id
  join public.documents document
    on document.id = chunk.document_id
  where input.source_type = 'institutional'
    and (
      (
        document.status = 'published'::public.document_status
        and (document.expires_at is null or document.expires_at > now())
      )
      or (
        p_include_archived
        and document.status = 'archived'::public.document_status
      )
    )
    and (select private.student_matches_target(
      document.target_departments,
      document.target_semesters,
      document.target_sections
    ))
  for share of document, chunk;

  perform 1
  from jsonb_to_recordset(p_sources) as input(source_id uuid, source_type text)
  join public.personal_document_chunks chunk
    on chunk.id = input.source_id
  join public.personal_documents document
    on document.id = chunk.personal_document_id
  where input.source_type = 'personal'
    and document.student_id = v_student_id
    and document.status = 'ready'::public.personal_document_status
  for share of document, chunk;

  with requested as (
    select distinct input.source_id, input.source_type
    from jsonb_to_recordset(p_sources) as input(source_id uuid, source_type text)
  ),
  authorized as (
    select requested.source_id, requested.source_type
    from requested
    join public.document_chunks chunk
      on chunk.id = requested.source_id
    join public.documents document
      on document.id = chunk.document_id
    where requested.source_type = 'institutional'
      and (
        (
          document.status = 'published'::public.document_status
          and (document.expires_at is null or document.expires_at > now())
        )
        or (
          p_include_archived
          and document.status = 'archived'::public.document_status
        )
      )
      and (select private.student_matches_target(
        document.target_departments,
        document.target_semesters,
        document.target_sections
      ))

    union all

    select requested.source_id, requested.source_type
    from requested
    join public.personal_document_chunks chunk
      on chunk.id = requested.source_id
    join public.personal_documents document
      on document.id = chunk.personal_document_id
    where requested.source_type = 'personal'
      and document.student_id = v_student_id
      and document.status = 'ready'::public.personal_document_status
  )
  select count(*)::integer
  into v_authorized_source_count
  from authorized;

  if v_requested_source_count <> v_authorized_source_count then
    raise exception 'One or more retrieved sources are no longer authorized';
  end if;

  insert into public.chat_messages (id, conversation_id, role, content)
  values (
    p_assistant_message_id,
    p_conversation_id,
    'assistant'::public.chat_message_role,
    p_content
  );

  with requested as (
    select distinct input.source_id, input.source_type
    from jsonb_to_recordset(p_sources) as input(source_id uuid, source_type text)
  ),
  authorized_sources as (
    select
      document.id as document_id,
      null::uuid as personal_document_id,
      document.title as source_title
    from requested
    join public.document_chunks chunk
      on chunk.id = requested.source_id
    join public.documents document
      on document.id = chunk.document_id
    where requested.source_type = 'institutional'
      and (
        (
          document.status = 'published'::public.document_status
          and (document.expires_at is null or document.expires_at > now())
        )
        or (
          p_include_archived
          and document.status = 'archived'::public.document_status
        )
      )
      and (select private.student_matches_target(
        document.target_departments,
        document.target_semesters,
        document.target_sections
      ))

    union

    select
      null::uuid as document_id,
      document.id as personal_document_id,
      document.title as source_title
    from requested
    join public.personal_document_chunks chunk
      on chunk.id = requested.source_id
    join public.personal_documents document
      on document.id = chunk.personal_document_id
    where requested.source_type = 'personal'
      and document.student_id = v_student_id
      and document.status = 'ready'::public.personal_document_status
  )
  insert into public.message_sources (
    message_id,
    document_id,
    personal_document_id,
    source_title
  )
  select
    p_assistant_message_id,
    authorized_sources.document_id,
    authorized_sources.personal_document_id,
    authorized_sources.source_title
  from authorized_sources;

  update public.chat_conversations
  set updated_at = now()
  where id = p_conversation_id
    and student_id = v_student_id;

  return p_assistant_message_id;
end;
$$;

revoke all on function public.finalize_student_chat_response(uuid, uuid, text, jsonb, boolean)
from public, anon;
grant execute on function public.finalize_student_chat_response(uuid, uuid, text, jsonb, boolean)
to authenticated;
