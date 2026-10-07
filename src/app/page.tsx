import { redirect } from 'next/navigation'
import { getCurrentUserIdentity } from '@/utils/auth'

export default async function HomePage() {
  const identity = await getCurrentUserIdentity()

  if (identity.isAdmin) {
    redirect('/admin')
  }

  if (identity.student) {
    if (identity.student.account_status === 'pending') {
      const searchParams = new URLSearchParams({
        pending: 'true',
        name: identity.student.institutional_name || '',
        roll: identity.student.roll_number || '',
        dept: identity.student.department || '',
        sem: identity.student.semester ? String(identity.student.semester) : '',
        sec: identity.student.section || '',
      })
      redirect(`/login?${searchParams.toString()}`)
    }
    if (identity.student.account_status === 'active') {
      redirect('/student')
    }
    redirect('/unauthorized')
  }

  // If not logged in, redirect to login
  redirect('/login')
}
