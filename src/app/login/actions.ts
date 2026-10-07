'use server'

import { createClient } from '@/utils/supabase/server'
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

  // Find the role and redirect accordingly
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
  const department = formData.get('department') as string | null
  const semester = formData.get('semester') as string | null
  const supabase = await createClient()

  // Security: All public signups are strictly defaulted to 'student'.
  // Admin provisioning is handled manually by administrators.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'student',
        department: department || '',
        semester: semester || '',
      }
    }
  })

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  // If email confirmation is required by Supabase, no active session exists yet
  if (!data?.session) {
    redirect(`/login?message=${encodeURIComponent('Account created successfully! Please check your email to verify your account before signing in.')}`)
  }

  redirect('/student')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
