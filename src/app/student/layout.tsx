import { StudentShell } from '@/components/StudentShell'
import { signout } from '@/app/login/actions'
import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await verifyStudentSession()

  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const student = auth.student
  const deptStr = student.department ? `${student.department} · Sem ${student.semester || 1}` : 'Student'

  return (
    <StudentShell
      userEmail={auth.user?.email || student.display_name || ''}
      userDepartment={deptStr}
      signOutAction={signout}
    >
      {children}
    </StudentShell>
  )
}
