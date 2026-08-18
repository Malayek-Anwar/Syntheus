import Link from 'next/link'
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <span className="text-xl font-bold text-gray-900">Student Portal</span>
          </div>
          <nav className="p-4 space-y-1">
            <Link 
              href="/student" 
              className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Home
            </Link>
            <Link 
              href="/student/notices" 
              className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Institutional Notices
            </Link>
            <Link 
              href="/student/chat" 
              className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              AI Campus Assistant
            </Link>
            <Link 
              href="/student/my-documents" 
              className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              My Documents
            </Link>
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="mb-4 px-4">
            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
            <p className="text-xs text-gray-500 truncate">{user.user_metadata?.department}</p>
          </div>
          <form action={signout}>
            <button className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
