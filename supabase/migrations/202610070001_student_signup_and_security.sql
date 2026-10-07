-- Migration: Student Signup Flow & Academic Identity Protection
-- Allows authenticated student to create initial pending claim,
-- while strictly preventing students from modifying authoritative academic fields or account_status.

-- 1. Ensure RLS is enabled on students
alter table public.students enable row level security;

-- 2. Drop existing policies if any to recreate clean, strict policies
drop policy if exists "Students can view own profile" on public.students;
drop policy if exists "Students can insert own pending profile" on public.students;
drop policy if exists "Students can update own display_name only" on public.students;
drop policy if exists "Admins have full access to students" on public.students;

-- Policy: Authenticated users can view their own student profile, and admins can view all
create policy "Students can view own profile"
  on public.students for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_admin()
  );

-- Policy: An authenticated user can create their initial pending claim
create policy "Students can insert own pending profile"
  on public.students for insert
  to authenticated
  with check (
    auth.uid() = id
    and account_status = 'pending'
  );

-- Policy: Admins have full update and management access to students
create policy "Admins have full access to students"
  on public.students for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Policy: Students can only update their own display_name (not authoritative academic fields)
create policy "Students can update own display_name only"
  on public.students for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and account_status = (select s.account_status from public.students s where s.id = auth.uid())
    and roll_number is not distinct from (select s.roll_number from public.students s where s.id = auth.uid())
    and institutional_name is not distinct from (select s.institutional_name from public.students s where s.id = auth.uid())
    and department is not distinct from (select s.department from public.students s where s.id = auth.uid())
    and semester is not distinct from (select s.semester from public.students s where s.id = auth.uid())
    and section is not distinct from (select s.section from public.students s where s.id = auth.uid())
  );

-- 3. Database Trigger: Protect student authoritative academic fields & verification status
create or replace function public.protect_student_academic_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If executed by an admin, allow all modifications
  if public.is_admin() then
    return new;
  end if;

  -- For non-admins (students), prevent mutating verification status or academic fields
  if new.account_status is distinct from old.account_status then
    raise exception 'Students cannot modify account verification status';
  end if;

  if new.roll_number is distinct from old.roll_number then
    raise exception 'Students cannot modify roll number';
  end if;

  if new.institutional_name is distinct from old.institutional_name then
    raise exception 'Students cannot modify institutional name';
  end if;

  if new.department is distinct from old.department then
    raise exception 'Students cannot modify department';
  end if;

  if new.semester is distinct from old.semester then
    raise exception 'Students cannot modify semester';
  end if;

  if new.section is distinct from old.section then
    raise exception 'Students cannot modify section';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_student_academic_fields on public.students;
create trigger trg_protect_student_academic_fields
  before update on public.students
  for each row
  execute function public.protect_student_academic_fields();
