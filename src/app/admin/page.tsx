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
        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Circulars</p>
          <p className="text-3xl font-extrabold text-[#176b61] tracking-tight">{liveCount}</p>
          <p className="text-[11px] text-slate-400">Published to student feed</p>
        </div>

        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Drafts</p>
          <p className="text-3xl font-extrabold text-amber-700 tracking-tight">{draftCount}</p>
          <p className="text-[11px] text-slate-400">Hidden from students</p>
        </div>

        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Deadlines</p>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeDeadlines}</p>
          <p className="text-[11px] text-slate-400">Cutoffs pending</p>
        </div>

        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Archived</p>
          <p className="text-3xl font-extrabold text-slate-700 tracking-tight">{archivedCount}</p>
          <p className="text-[11px] text-slate-400">Historical records</p>
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
