import { AdminShell } from '@/components/AdminShell'
import { signout } from '@/app/login/actions'
import { verifyAdminAction } from '@/utils/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await verifyAdminAction()
  if (!auth.authorized) {
    redirect('/unauthorized')
  }

  return (
    <AdminShell
      userEmail={auth.user?.email || ''}
      signOutAction={signout}
    >
      {children}
    </AdminShell>
  )
}
