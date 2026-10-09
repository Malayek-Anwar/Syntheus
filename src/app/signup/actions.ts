'use server'

import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { normalizeSection, ALL_DEPARTMENTS } from '@/utils/audience'

export type SignupResult =
  | {
      ok: true
      name: string
      rollNumber: string
      department: string
      semester: number
      section: string | null
      email: string
    }
  | {
      ok: false
      message: string
    }

function getText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

export async function signup(formData: FormData): Promise<SignupResult> {
  const email = getText(formData, 'email').toLowerCase()
  const password = String(formData.get('password') ?? '')
  const name = getText(formData, 'institutional_name')
  const rollNumber = getText(formData, 'roll_number')
  const department = getText(formData, 'department').toUpperCase()
  const rawSemester = getText(formData, 'semester')
  const section = normalizeSection(getText(formData, 'section'))
  const semester = Number.parseInt(rawSemester, 10)

  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Please enter a valid email address.' }
  }
  if (password.length < 6) {
    return { ok: false, message: 'Password must contain at least 6 characters.' }
  }
  if (!name || !rollNumber || !department || !Number.isInteger(semester)) {
    return { ok: false, message: 'Please fill in all required academic fields.' }
  }
  if (!ALL_DEPARTMENTS.includes(department as (typeof ALL_DEPARTMENTS)[number])) {
    return { ok: false, message: 'Please select a valid department.' }
  }
  if (semester < 1 || semester > 8) {
    return { ok: false, message: 'Please select a valid semester.' }
  }

  const supabase = createServiceRoleClient()

  const { data: existingStudent, error: existingStudentError } = await supabase
    .from('students')
    .select('id')
    .eq('roll_number', rollNumber)
    .maybeSingle()

  if (existingStudentError) {
    console.error('Student registration lookup failed:', existingStudentError)
    return { ok: false, message: 'Unable to verify the roll number right now. Please try again.' }
  }

  if (existingStudent) {
    return {
      ok: false,
      message: 'Roll number "' + rollNumber + '" is already registered. Please sign in instead.',
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    if (authError?.code === 'email_exists') {
      return {
        ok: false,
        message: 'An account with this email address already exists. Please sign in instead.',
      }
    }
    console.error('Student Auth registration failed:', authError)
    return { ok: false, message: authError?.message || 'Unable to create the account.' }
  }

  const userId = authData.user.id

  try {
    const { error: appUserError } = await supabase
      .from('app_users')
      .insert({ id: userId })

    if (appUserError) {
      throw new Error('Failed to create application identity: ' + appUserError.message)
    }

    const { error: studentError } = await supabase
      .from('students')
      .insert({
        id: userId,
        roll_number: rollNumber,
        account_status: 'pending',
        institutional_name: name,
        display_name: name,
        department,
        semester,
        section,
      })

    if (studentError) {
      if (studentError.code === '23505') {
        throw new Error('Roll number "' + rollNumber + '" is already registered.')
      }
      throw new Error('Failed to create pending student record: ' + studentError.message)
    }
  } catch (error) {
    const cleanup = await supabase.auth.admin.deleteUser(userId)
    if (cleanup.error) {
      console.error('Failed to clean up orphaned Auth user after signup failure:', cleanup.error)
    }
    const message = error instanceof Error ? error.message : 'Unable to create the student record.'
    return { ok: false, message }
  }

  return { ok: true, name, rollNumber, department, semester, section, email }
}
