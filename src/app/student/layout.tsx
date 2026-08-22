import { StudentShell } from '@/components/StudentShell'
import { signout } from '@/app/login/actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'student') {
    redirect('/login')
  }

  return (
    <StudentShell
      userEmail={user.email || ''}
      userDepartment={user.user_metadata?.department || ''}
      signOutAction={signout}
    >
      {children}
    </StudentShell>
  )
}
