import { verifyAdminAction } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { AdminUploadForm } from '@/components/AdminUploadForm'
import { AdminDocumentDirectory } from '@/components/AdminDocumentDirectory'

export default async function AdminDashboard() {
  const auth = await verifyAdminAction()
  if (!auth.authorized) {
    redirect('/student')
  }

  const { supabase } = auth

  // Fetch all documents (published, drafts, and archived)
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  const now = new Date()

  // Compute live quick stats
  let liveCount = 0
  let draftCount = 0
  let archivedCount = 0
  let activeDeadlines = 0

  for (const doc of documents ?? []) {
    if (doc.is_archived) {
      archivedCount++
    } else if (doc.is_published === false) {
      draftCount++
    } else {
      liveCount++
      if (doc.deadline) {
        const dl = new Date(doc.deadline)
        if (dl >= now) {
          activeDeadlines++
        }
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 sm:space-y-10 w-full">
      {/* Clean Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Upload, review, edit, and manage institutional circular lifecycles with AI-powered extraction.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
            Administrator
          </span>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{liveCount}</p>
            <p className="text-xs text-gray-500 font-medium">Live Notices</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{draftCount}</p>
            <p className="text-xs text-gray-500 font-medium">Drafts</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeDeadlines}</p>
            <p className="text-xs text-gray-500 font-medium">Active Deadlines</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 border border-gray-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{archivedCount}</p>
            <p className="text-xs text-gray-500 font-medium">Archived</p>
          </div>
        </div>
      </section>

      {/* Upload Studio Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Institutional Document Publishing Studio</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Upload institutional notices, academic calendars, fee circulars, or lecture notes. Save as draft or publish directly to targeted students.
          </p>
        </div>

        <AdminUploadForm />
      </section>

      {/* Document Directory with Full Lifecycle & Search */}
      <section className="space-y-4 pt-4 border-t border-gray-200">
        <AdminDocumentDirectory documents={documents ?? []} />
      </section>
    </div>
  )
}
