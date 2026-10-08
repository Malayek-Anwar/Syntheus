-- Run after the Phase 1 migrations in the Supabase SQL Editor.
-- These catalog assertions are read-only and require no test student fixtures.
do $$
declare
  institutional_rpc regprocedure :=
    to_regprocedure('public.match_student_institutional_chunks(text,extensions.vector,integer,boolean)');
  personal_rpc regprocedure :=
    to_regprocedure('public.match_student_personal_chunks(text,extensions.vector,integer)');
  institutional_impl regprocedure :=
    to_regprocedure('private.match_student_institutional_chunks(text,extensions.vector,integer,boolean)');
  personal_impl regprocedure :=
    to_regprocedure('private.match_student_personal_chunks(text,extensions.vector)');
  finalize_rpc regprocedure :=
    to_regprocedure('public.finalize_student_chat_response(uuid,uuid,text,uuid,text,jsonb,boolean)');
begin
  if not coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'document_chunks'
  ), false) then
    raise exception 'RLS is not enabled on public.document_chunks';
  end if;

  if has_table_privilege('anon', 'public.document_chunks', 'select') then
    raise exception 'anon has direct SELECT privilege on public.document_chunks';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'document_chunks'
      and cmd = 'SELECT'
  ) then
    raise exception 'A direct SELECT policy exists on public.document_chunks';
  end if;

  if institutional_rpc is null then
    raise exception 'The institutional retrieval RPC is missing';
  end if;

  if has_function_privilege('anon', institutional_rpc, 'execute') then
    raise exception 'The institutional retrieval RPC is executable by anon';
  end if;

  if personal_rpc is null then
    raise exception 'The personal retrieval RPC is missing';
  end if;

  if has_function_privilege('anon', personal_rpc, 'execute') then
    raise exception 'The personal retrieval RPC is executable by anon';
  end if;

  if institutional_impl is null or position('>= 0.30' in pg_get_functiondef(institutional_impl)) = 0 then
    raise exception 'The institutional retrieval implementation is missing the 0.30 gate';
  end if;

  if personal_impl is null or position('>= 0.30' in pg_get_functiondef(personal_impl)) = 0 then
    raise exception 'The personal retrieval implementation is missing the 0.30 gate';
  end if;

  if finalize_rpc is null then
    raise exception 'The atomic chat finalization RPC is missing';
  end if;

  if exists (
    select 1
    from pg_proc
    where oid in (institutional_rpc, personal_rpc, finalize_rpc)
      and prosecdef
  ) then
    raise exception 'An exposed Phase 1 RPC is still SECURITY DEFINER';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_document_chunks'
      and policyname = 'personal_document_chunks_select_owner'
      and cmd = 'SELECT'
  ) then
    raise exception 'The personal chunk owner SELECT policy is missing';
  end if;

  if has_table_privilege('authenticated', 'public.personal_document_chunks', 'insert')
     or has_table_privilege('authenticated', 'public.personal_document_chunks', 'update')
     or has_table_privilege('authenticated', 'public.personal_document_chunks', 'delete') then
    raise exception 'Authenticated users can directly mutate personal chunks';
  end if;
end;
$$;
