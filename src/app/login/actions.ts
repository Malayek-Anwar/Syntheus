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
export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
