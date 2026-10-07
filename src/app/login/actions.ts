'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'

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

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role || user?.user_metadata?.role

  if (role === 'admin') {
    redirect('/admin')
  } else {
    redirect('/student')
  }
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const displayName = formData.get('display_name') as string | null
  const rollNumber = formData.get('roll_number') as string | null
  const department = formData.get('department') as string | null
  const semesterValue = formData.get('semester') as string | null
  const section = formData.get('section') as string | null
  const supabase = await createClient()

  // Public signup is always a student signup. Admin provisioning is separate.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'student',
      },
    },
  })

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  const userId = data.user?.id
  if (!userId) {
    redirect(`/signup?message=${encodeURIComponent('Account creation did not return a user ID. Please try again.')}`)
  }

  const semester = semesterValue ? Number(semesterValue) : null

  if (
    !displayName?.trim() ||
    !rollNumber?.trim() ||
    !department ||
    !semester ||
    semester < 1 ||
    semester > 8
  ) {
    redirect(`/signup?message=${encodeURIComponent('Please complete all required student details.')}`)
  }

  // Registration data is unverified, so the profile is created as pending.
  // This uses the server-only secret key; it is never exposed to the browser.
  const supabaseAdmin = createAdminClient()
  const { error: studentError } = await supabaseAdmin
    .from('students')
    .insert({
      id: userId,
      roll_number: rollNumber.trim(),
      account_status: 'pending',
      institutional_name: displayName.trim(),
      display_name: displayName.trim(),
      department: department.trim().toUpperCase(),
      semester,
      section: section?.trim() ? section.trim().toUpperCase() : null,
    })

  if (studentError) {
    // Do not leave an Auth account without its required application profile.
    await supabaseAdmin.auth.admin.deleteUser(userId)
    redirect(`/signup?message=${encodeURIComponent('We could not create your student profile. Please try again.')}`)
  }

  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent('Account created successfully! Please check your email to verify your account before signing in.')}`)
  }

  redirect('/student')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
