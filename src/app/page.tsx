import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.app_metadata?.role
    if (role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/student')
    }
  }

  // If not logged in, redirect to login
  redirect('/login')
}
