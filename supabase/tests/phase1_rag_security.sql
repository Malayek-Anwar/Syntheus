-- Run after the Phase 1 migrations in the Supabase SQL Editor.
-- These catalog assertions are read-only and require no test student fixtures.
do $$
declare
  institutional_rpc regprocedure :=
    to_regprocedure('public.match_student_institutional_chunks(text,extensions.vector,integer,boolean)');
  personal_rpc regprocedure :=
    to_regprocedure('public.match_student_personal_chunks(text,extensions.vector,integer)');
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

  if position('>= 0.30' in pg_get_functiondef(institutional_rpc)) = 0 then
    raise exception 'The institutional retrieval RPC is missing the 0.30 gate';
  end if;

  if position('>= 0.30' in pg_get_functiondef(personal_rpc)) = 0 then
    raise exception 'The personal retrieval RPC is missing the 0.30 gate';
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
