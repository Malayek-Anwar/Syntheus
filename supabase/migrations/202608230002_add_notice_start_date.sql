alter table public.documents
  add column if not exists starts_at timestamptz;
