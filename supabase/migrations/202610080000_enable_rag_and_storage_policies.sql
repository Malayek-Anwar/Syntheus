-- Migration: Comprehensive RLS Policies, Table Grants, and Vector Match RPCs for Syntheus V1 RAG
-- Fixes permission denied on document_chunks, personal_document_chunks, and enables full RAG search.

-- 1. Grant table access to standard Supabase roles
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

grant select on public.documents to anon;
grant select on public.document_chunks to anon;
grant select on public.academic_events to anon;
grant select on public.timetables to anon;
grant select on public.timetable_entries to anon;

-- 2. Documents RLS Policies
alter table public.documents enable row level security;
drop policy if exists "Allow reading published documents" on public.documents;
create policy "Allow reading published documents"
  on public.documents for select
  to authenticated, anon
  using (status in ('published', 'archived') or public.is_admin());

drop policy if exists "Admins can manage documents" on public.documents;
create policy "Admins can manage documents"
  on public.documents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Document Chunks RLS Policies
alter table public.document_chunks enable row level security;
drop policy if exists "Allow reading document chunks" on public.document_chunks;
create policy "Allow reading document chunks"
  on public.document_chunks for select
  to authenticated, anon
  using (true);

drop policy if exists "Admins can manage document chunks" on public.document_chunks;
create policy "Admins can manage document chunks"
  on public.document_chunks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Personal Documents RLS Policies
alter table public.personal_documents enable row level security;
drop policy if exists "Students can manage own personal documents" on public.personal_documents;
create policy "Students can manage own personal documents"
  on public.personal_documents for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- 5. Personal Document Chunks RLS Policies
alter table public.personal_document_chunks enable row level security;
drop policy if exists "Students can manage own personal document chunks" on public.personal_document_chunks;
create policy "Students can manage own personal document chunks"
  on public.personal_document_chunks for all
  to authenticated
  using (
    exists (
      select 1 from public.personal_documents pd
      where pd.id = personal_document_chunks.personal_document_id
        and pd.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.personal_documents pd
      where pd.id = personal_document_chunks.personal_document_id
        and pd.student_id = auth.uid()
    )
  );

-- 6. Chat Conversations, Messages, and Sources
alter table public.chat_conversations enable row level security;
drop policy if exists "Students can manage own chat conversations" on public.chat_conversations;
create policy "Students can manage own chat conversations"
  on public.chat_conversations for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

alter table public.chat_messages enable row level security;
drop policy if exists "Students can manage own chat messages" on public.chat_messages;
create policy "Students can manage own chat messages"
  on public.chat_messages for all
  to authenticated
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.student_id = auth.uid()
    )
  );

alter table public.message_sources enable row level security;
drop policy if exists "Students can manage own message sources" on public.message_sources;
create policy "Students can manage own message sources"
  on public.message_sources for all
  to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      join public.chat_conversations c on c.id = m.conversation_id
      where m.id = message_sources.message_id
        and c.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_messages m
      join public.chat_conversations c on c.id = m.conversation_id
      where m.id = message_sources.message_id
        and c.student_id = auth.uid()
    )
  );

-- 7. Document Completions
alter table public.document_completions enable row level security;
drop policy if exists "Students and admins manage completions" on public.document_completions;
create policy "Students and admins manage completions"
  on public.document_completions for all
  to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- 8. Academic Events & Timetables
alter table public.academic_events enable row level security;
drop policy if exists "Allow reading academic events" on public.academic_events;
create policy "Allow reading academic events"
  on public.academic_events for select
  to authenticated, anon
  using (true);

drop policy if exists "Admins can manage academic events" on public.academic_events;
create policy "Admins can manage academic events"
  on public.academic_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.timetables enable row level security;
drop policy if exists "Allow reading timetables" on public.timetables;
create policy "Allow reading timetables"
  on public.timetables for select
  to authenticated, anon
  using (true);

drop policy if exists "Admins can manage timetables" on public.timetables;
create policy "Admins can manage timetables"
  on public.timetables for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.timetable_entries enable row level security;
drop policy if exists "Allow reading timetable entries" on public.timetable_entries;
create policy "Allow reading timetable entries"
  on public.timetable_entries for select
  to authenticated, anon
  using (true);

drop policy if exists "Admins can manage timetable entries" on public.timetable_entries;
create policy "Admins can manage timetable entries"
  on public.timetable_entries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 9. PostgreSQL pgvector RPC Functions for High-Performance Similarity Matching
create or replace function public.match_document_chunks(
  query_embedding vector(384),
  match_count int default 8,
  filter_document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where (filter_document_ids is null or c.document_id = any(filter_document_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_personal_document_chunks(
  query_embedding vector(384),
  filter_student_id uuid,
  match_count int default 8,
  filter_personal_document_ids uuid[] default null
)
returns table (
  id uuid,
  personal_document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pc.id,
    pc.personal_document_id,
    pc.chunk_index,
    pc.content,
    1 - (pc.embedding <=> query_embedding) as similarity
  from public.personal_document_chunks pc
  join public.personal_documents pd on pd.id = pc.personal_document_id
  where pd.student_id = filter_student_id
    and (filter_personal_document_ids is null or pc.personal_document_id = any(filter_personal_document_ids))
  order by pc.embedding <=> query_embedding
  limit match_count;
$$;
