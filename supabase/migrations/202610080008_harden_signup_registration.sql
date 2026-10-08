-- Phase 2: pending student registration is server-controlled.
-- Browser clients must not be able to create arbitrary pending student identities.

drop policy if exists students_insert_own_pending on public.students;
drop policy if exists "students_insert_own_pending" on public.students;
revoke insert on public.students from authenticated;
