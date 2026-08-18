import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const role = user.user_metadata?.role
    if (role === 'admin') {
      redirect('/admin')
    } else if (role === 'student') {
      redirect('/student')
    } else {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Account Error</h1>
            <p className="mt-2 text-gray-600">Your account does not have an assigned role.</p>
            <form action={async () => {
              'use server'
              const sb = await createClient()
              await sb.auth.signOut()
              redirect('/login')
            }}>
              <button type="submit" className="mt-4 px-4 py-2 bg-black text-white rounded-md">Sign out</button>
            </form>
          </div>
        </div>
      )
    }
  }

  // If not logged in, redirect to login
  redirect('/login')
}
