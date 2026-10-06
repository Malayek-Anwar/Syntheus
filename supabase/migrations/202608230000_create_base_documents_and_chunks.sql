-- Enable pgvector extension for RAG embeddings
create extension if not exists vector;

-- Base institutional documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  doc_type text default 'general_notice',
  audience text,
  target_departments text[] default '{}',
  target_semesters integer[] default '{}',
  summary text,
  key_points text[] default '{}',
  action_items text[] default '{}',
  timeline jsonb default '[]'::jsonb,
  subject_code text,
  dates text,
  starts_at timestamptz,
  deadline timestamptz,
  priority text default 'Medium',
  file_url text not null,
  is_published boolean default true,
  is_archived boolean default false,
  status text default 'published',
  created_at timestamptz default timezone('utc', now())
);

-- Index for speedy audience filtering and ordering
create index if not exists idx_documents_published on public.documents (is_published, is_archived, created_at desc);
create index if not exists idx_documents_target_depts on public.documents using gin (target_departments);
create index if not exists idx_documents_target_sems on public.documents using gin (target_semesters);

-- Document chunks table with pgvector embeddings
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_text text not null,
  embedding vector(384),
  created_at timestamptz default timezone('utc', now())
);

create index if not exists idx_document_chunks_document_id on public.document_chunks (document_id);

-- Personal documents table for students' private uploads
create table if not exists public.personal_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_url text not null,
  embedding jsonb,
  created_at timestamptz default timezone('utc', now())
);

create index if not exists idx_personal_documents_user_id on public.personal_documents (user_id);

-- Enable RLS
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.personal_documents enable row level security;

-- Policies for public.documents
create policy "Published documents are viewable by all authenticated users"
  on public.documents for select
  to authenticated
  using (is_published = true or (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Admins have full access to documents"
  on public.documents for all
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Policies for public.document_chunks
create policy "Authenticated users can query document chunks"
  on public.document_chunks for select
  to authenticated
  using (true);

create policy "Admins can manage document chunks"
  on public.document_chunks for all
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Policies for public.personal_documents
create policy "Users can manage their own personal documents"
  on public.personal_documents for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Hybrid search RPC function
create or replace function public.match_documents_hybrid(
  query_embedding vector(384),
  query_text text,
  filter_department text default null,
  filter_semester integer default null,
  match_count integer default 5,
  rrf_k integer default 60
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  chunk_text text,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    d.title,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.is_published = true
    and (d.is_archived = false or d.is_archived is null)
    and (
      filter_department is null
      or cardinality(d.target_departments) = 0
      or 'All' = any(d.target_departments)
      or filter_department = any(d.target_departments)
    )
    and (
      filter_semester is null
      or cardinality(d.target_semesters) = 0
      or filter_semester = any(d.target_semesters)
    )
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
