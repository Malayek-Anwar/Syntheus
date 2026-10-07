'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { normalizeSection } from '@/utils/audience'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  // Find identity by domain table membership
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 1. Check if admin
  const { data: adminRecord } = await supabase
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (adminRecord) {
    redirect('/admin')
  }

  // 2. Check student record
  const { data: studentRecord } = await supabase
    .from('students')
    .select('id, account_status, roll_number, institutional_name, department, semester, section')
    .eq('id', user.id)
    .maybeSingle()

  if (studentRecord) {
    if (studentRecord.account_status === 'pending') {
      await supabase.auth.signOut()
      const searchParams = new URLSearchParams({
        pending: 'true',
        name: studentRecord.institutional_name || '',
        roll: studentRecord.roll_number || '',
        dept: studentRecord.department || '',
        sem: studentRecord.semester ? String(studentRecord.semester) : '',
        sec: studentRecord.section || '',
      })
      redirect(`/login?${searchParams.toString()}`)
    }
    if (studentRecord.account_status === 'suspended') {
      await supabase.auth.signOut()
      redirect(`/login?message=${encodeURIComponent('Your student account has been suspended. Please contact the administrator.')}`)
    }
  }

  redirect('/student')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const rollNumber = (formData.get('roll_number') as string | null)?.trim() || null
  const institutionalName = (formData.get('institutional_name') as string | null)?.trim() || null
  const displayName = (formData.get('display_name') as string | null)?.trim() || null
  const department = (formData.get('department') as string | null)?.trim() || null
  const rawSemester = formData.get('semester') as string | null
  const rawSection = formData.get('section') as string | null

  const semesterNum = rawSemester ? parseInt(rawSemester.replace(/\D/g, ''), 10) : null
  const validSemester = semesterNum && semesterNum >= 1 && semesterNum <= 8 ? semesterNum : null
  const normalizedSec = normalizeSection(rawSection)

  const supabase = await createClient()

  // 1. Check if roll number is already registered in students table
  if (rollNumber) {
    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('roll_number', rollNumber)
      .maybeSingle()

    if (existingStudent) {
      redirect(`/login?message=${encodeURIComponent(`Roll number ${rollNumber} is already registered. Please sign in.`)}`)
    }
  }

  // 2. Create user with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        institutional_name: institutionalName,
        roll_number: rollNumber,
        department,
        semester: validSemester,
        section: normalizedSec,
      },
    },
  })

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  const userId = data.user?.id
  if (userId) {
    // 3. Create app_users record
    await supabase.from('app_users').upsert({
      id: userId,
      updated_at: new Date().toISOString(),
    })

    // 4. Create student domain record with account_status: 'pending'
    const { error: insertError } = await supabase.from('students').insert({
      id: userId,
      roll_number: rollNumber,
      account_status: 'pending',
      institutional_name: institutionalName || email.split('@')[0],
      display_name: displayName || institutionalName || email.split('@')[0],
      department: department || null,
      semester: validSemester,
      section: normalizedSec,
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('Error inserting pending student:', insertError)
    }

    // Sign out newly created user so they don't hold active session prior to admin verification
    await supabase.auth.signOut()
  }

  const searchParams = new URLSearchParams({
    pending: 'true',
    name: institutionalName || '',
    roll: rollNumber || '',
    dept: department || '',
    sem: validSemester ? String(validSemester) : '',
    sec: normalizedSec || '',
    email: email || '',
  })
  redirect(`/signup?${searchParams.toString()}`)
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
