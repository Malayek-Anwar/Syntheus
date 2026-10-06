create table if not exists public.notice_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_id uuid not null references public.documents(id) on delete cascade,
  completed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, notice_id)
);

alter table public.notice_completions enable row level security;

create policy "Students can view their own notice completions"
  on public.notice_completions for select
  using (auth.uid() = user_id);

create policy "Students can create their own notice completions"
  on public.notice_completions for insert
  with check (auth.uid() = user_id);

create policy "Students can remove their own notice completions"
  on public.notice_completions for delete
  using (auth.uid() = user_id);
