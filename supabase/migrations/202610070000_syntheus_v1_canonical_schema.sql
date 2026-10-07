-- Syntheus V1 Canonical Database Schema
-- Status: LOCKED V1 DESIGN

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- 1. Enums
do $$ begin
  create type public.account_status as enum ('pending', 'active', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_status as enum ('draft', 'processing', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_category as enum (
    'notice',
    'circular',
    'schedule',
    'calendar',
    'syllabus',
    'form',
    'admission',
    'registration',
    'scholarship',
    'placement',
    'fees',
    'notes',
    'reference_material',
    'question_paper',
    'question_bank',
    'assignment'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.personal_document_status as enum ('processing', 'ready');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.chat_message_role as enum ('user', 'assistant');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.academic_event_type as enum (
    'exam',
    'assignment_deadline',
    'registration_deadline',
    'admission_deadline',
    'scholarship_deadline',
    'semester_start',
    'semester_end',
    'holiday',
    'class_event',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- 2. Core Identity
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.students (
  id uuid primary key references public.app_users(id) on delete cascade,
  roll_number text unique,
  account_status public.account_status not null default 'pending',
  institutional_name text,
  display_name text,
  department text,
  semester smallint check (semester is null or (semester >= 1 and semester <= 8)),
  section text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admins (
  id uuid primary key references public.app_users(id) on delete cascade,
  name text not null,
  position text not null,
  department text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Helper functions for RLS
create or replace function public.is_student()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students
    where id = auth.uid()
      and account_status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins
    where id = auth.uid()
  );
$$;

-- 3. Institutional Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.document_category not null,
  status public.document_status not null default 'draft',
  tracks_completion boolean not null default false,
  target_departments text[],
  target_semesters smallint[],
  target_sections text[],
  expires_at timestamptz,
  storage_bucket text not null default 'institutional-documents',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size bigint not null check (file_size > 0),
  uploaded_by uuid not null references public.admins(id),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_documents_status on public.documents (status, expires_at);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_documents_target_depts on public.documents using gin (target_departments);
create index if not exists idx_documents_target_sems on public.documents using gin (target_semesters);
create index if not exists idx_documents_target_secs on public.documents using gin (target_sections);

-- 4. Document Chunks
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding vector(384) not null,
  search_vector tsvector generated always as (to_tsvector('english', content)) stored,
  page_number integer check (page_number is null or page_number > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique(document_id, chunk_index)
);

create index if not exists idx_document_chunks_doc_id on public.document_chunks (document_id);
create index if not exists idx_document_chunks_search_vector on public.document_chunks using gin (search_vector);
create index if not exists idx_document_chunks_embedding on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- 5. Personal Documents
create table if not exists public.personal_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  description text,
  status public.personal_document_status not null default 'processing',
  storage_bucket text not null default 'personal-documents',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_personal_documents_student_id on public.personal_documents (student_id);

-- 6. Personal Document Chunks
create table if not exists public.personal_document_chunks (
  id uuid primary key default gen_random_uuid(),
  personal_document_id uuid not null references public.personal_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding vector(384) not null,
  search_vector tsvector generated always as (to_tsvector('english', content)) stored,
  page_number integer check (page_number is null or page_number > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique(personal_document_id, chunk_index)
);

create index if not exists idx_personal_chunks_personal_doc_id on public.personal_document_chunks (personal_document_id);
create index if not exists idx_personal_chunks_search_vector on public.personal_document_chunks using gin (search_vector);
create index if not exists idx_personal_chunks_embedding on public.personal_document_chunks using hnsw (embedding vector_cosine_ops);

-- 7. Chat Conversations
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chat_conversations_student_id on public.chat_conversations (student_id);

-- 8. Chat Messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role public.chat_message_role not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chat_messages_conv_id on public.chat_messages (conversation_id);

-- 9. Message Sources
create table if not exists public.message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  personal_document_id uuid references public.personal_documents(id) on delete set null,
  source_title text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (document_id is not null and personal_document_id is null) or
    (document_id is null and personal_document_id is not null)
  )
);

create index if not exists idx_message_sources_message_id on public.message_sources (message_id);
create index if not exists idx_message_sources_doc_id on public.message_sources (document_id);
create index if not exists idx_message_sources_personal_doc_id on public.message_sources (personal_document_id);

-- 10. Document Completions
create table if not exists public.document_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  document_title text not null,
  completed_at timestamptz not null default timezone('utc', now()),
  verified_by uuid references public.app_users(id),
  verified_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_student_active_doc_completion
  on public.document_completions (student_id, document_id)
  where document_id is not null;

create index if not exists idx_document_completions_student on public.document_completions (student_id);
create index if not exists idx_document_completions_document on public.document_completions (document_id);
create index if not exists idx_document_completions_verified on public.document_completions (verified_by);

-- 11. Academic Events
create table if not exists public.academic_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type public.academic_event_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_departments text[],
  target_semesters smallint[],
  target_sections text[],
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_academic_events_doc_id on public.academic_events (source_document_id);
create index if not exists idx_academic_events_type_starts on public.academic_events (event_type, starts_at);

-- 12. Timetables
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_departments text[],
  target_semesters smallint[],
  target_sections text[],
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until is null or valid_until >= valid_from)
);

create index if not exists idx_timetables_doc_id on public.timetables (source_document_id);

-- 13. Timetable Entries
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  subject text not null,
  room text,
  instructor text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_timetable_entries_timetable_day on public.timetable_entries (timetable_id, day_of_week);

-- Enable RLS across all tables
alter table public.app_users enable row level security;
alter table public.students enable row level security;
alter table public.admins enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.personal_documents enable row level security;
alter table public.personal_document_chunks enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.message_sources enable row level security;
alter table public.document_completions enable row level security;
alter table public.academic_events enable row level security;
alter table public.timetables enable row level security;
alter table public.timetable_entries enable row level security;

-- Targeted visibility check function for RLS
create or replace function public.is_target_match(
  doc_depts text[],
  doc_sems smallint[],
  doc_secs text[],
  stud_dept text,
  stud_sem smallint,
  stud_sec text
)
returns boolean
language sql
immutable
as $$
  select
    (doc_depts is null or (stud_dept is not null and stud_dept = any(doc_depts)))
    and
    (doc_sems is null or (stud_sem is not null and stud_sem = any(doc_sems)))
    and
    (
      doc_secs is null
      or (stud_sec is null and doc_secs is null)
      or (stud_sec is not null and upper(stud_sec) = any(doc_secs))
    );
$$;
