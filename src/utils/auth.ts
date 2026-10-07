import { createClient } from '@/utils/supabase/server'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { Admin, Student } from '@/types/database'

export type AdminAuthResult = {
  authorized: boolean
  user: User | null
  admin: Admin | null
  supabase: SupabaseClient
  error?: string
}

export type StudentAuthResult = {
  authorized: boolean
  user: User | null
  student: Student | null
  supabase: SupabaseClient
  error?: string
}

export type UserIdentityResult = {
  user: User | null
  isStudent: boolean
  isAdmin: boolean
  student: Student | null
  admin: Admin | null
  supabase: SupabaseClient
}

/**
 * Verifies that the current user has an authenticated session and is a member of the `admins` table.
 * Never relies on client metadata or JWT roles.
 */
export async function verifyAdminAction(): Promise<AdminAuthResult> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      authorized: false,
      user: null,
      admin: null,
      supabase,
      error: '403 Forbidden: Authentication required'
    }
  }

  // Canonical identity check: lookup in public.admins
  const { data: adminRecord, error: adminError } = await supabase
    .from('admins')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (adminError || !adminRecord) {
    return {
      authorized: false,
      user,
      admin: null,
      supabase,
      error: '403 Forbidden: Admin privileges required'
    }
  }

  return {
    authorized: true,
    user,
    admin: adminRecord as Admin,
    supabase
  }
}

/**
 * Verifies that the current user has an authenticated session and is an active student in `students`.
 * Never relies on client metadata or JWT roles.
 */
export async function verifyStudentSession(): Promise<StudentAuthResult> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      authorized: false,
      user: null,
      student: null,
      supabase,
      error: 'Authentication required'
    }
  }

  // Canonical identity check: lookup in public.students
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (studentError || !studentRecord) {
    return {
      authorized: false,
      user,
      student: null,
      supabase,
      error: 'Student record not found'
    }
  }

  if (studentRecord.account_status !== 'active') {
    return {
      authorized: false,
      user,
      student: studentRecord as Student,
      supabase,
      error: `Student account is ${studentRecord.account_status}`
    }
  }

  return {
    authorized: true,
    user,
    student: studentRecord as Student,
    supabase
  }
}

/**
 * Resolves the full domain identity for the currently logged in user.
 */
export async function getCurrentUserIdentity(): Promise<UserIdentityResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      isStudent: false,
      isAdmin: false,
      student: null,
      admin: null,
      supabase,
    }
  }

  const [adminQuery, studentQuery] = await Promise.all([
    supabase.from('admins').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('students').select('*').eq('id', user.id).maybeSingle(),
  ])

  const admin = adminQuery.data as Admin | null
  const student = studentQuery.data as Student | null

  return {
    user,
    isAdmin: Boolean(admin),
    isStudent: Boolean(student && student.account_status === 'active'),
    admin,
    student,
    supabase,
  }
}
