-- Keep privileged RAG/chat implementations outside the exposed API schema.
-- Public functions remain SECURITY INVOKER wrappers for Supabase RPC compatibility.

alter function public.match_student_institutional_chunks(
  text, extensions.vector, integer, boolean
) set schema private;

alter function public.match_student_personal_chunks(
  text, extensions.vector, integer
) set schema private;

alter function public.finalize_student_chat_response(
  uuid, uuid, text, uuid, text, jsonb, boolean
) set schema private;

revoke all on function private.match_student_institutional_chunks(
  text, extensions.vector, integer, boolean
) from public, anon;
grant execute on function private.match_student_institutional_chunks(
  text, extensions.vector, integer, boolean
) to authenticated;

revoke all on function private.match_student_personal_chunks(
  text, extensions.vector, integer
) from public, anon;
grant execute on function private.match_student_personal_chunks(
  text, extensions.vector, integer
) to authenticated;

revoke all on function private.finalize_student_chat_response(
  uuid, uuid, text, uuid, text, jsonb, boolean
) from public, anon;
grant execute on function private.finalize_student_chat_response(
  uuid, uuid, text, uuid, text, jsonb, boolean
) to authenticated;

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
security invoker
set search_path = ''
as $$
  select *
  from private.match_student_institutional_chunks(
    query_text, query_embedding, match_count, include_archived
  );
$$;

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
security invoker
set search_path = ''
as $$
  select *
  from private.match_student_personal_chunks(
    query_text, query_embedding, match_count
  );
$$;

create or replace function public.finalize_student_chat_response(
  p_conversation_id uuid,
  p_user_message_id uuid,
  p_user_content text,
  p_assistant_message_id uuid,
  p_content text,
  p_sources jsonb,
  p_include_archived boolean default false
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.finalize_student_chat_response(
    p_conversation_id,
    p_user_message_id,
    p_user_content,
    p_assistant_message_id,
    p_content,
    p_sources,
    p_include_archived
  );
$$;

revoke all on function public.match_student_institutional_chunks(
  text, extensions.vector, integer, boolean
) from public, anon;
grant execute on function public.match_student_institutional_chunks(
  text, extensions.vector, integer, boolean
) to authenticated;

revoke all on function public.match_student_personal_chunks(
  text, extensions.vector, integer
) from public, anon;
grant execute on function public.match_student_personal_chunks(
  text, extensions.vector, integer
) to authenticated;

revoke all on function public.finalize_student_chat_response(
  uuid, uuid, text, uuid, text, jsonb, boolean
) from public, anon;
grant execute on function public.finalize_student_chat_response(
  uuid, uuid, text, uuid, text, jsonb, boolean
) to authenticated;
