import { verifyAdminAction } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { AdminUploadForm } from '@/components/AdminUploadForm'
import { AdminDocumentDirectory } from '@/components/AdminDocumentDirectory'
import { AdminStudentDirectory } from '@/components/AdminStudentDirectory'
import type { Student } from '@/types/database'

export default async function AdminDashboard() {
  const auth = await verifyAdminAction()
  if (!auth.authorized) {
    redirect('/student')
  }

  const { supabase } = auth

  // Concurrently fetch documents and students
  const [docsRes, studentsRes] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, description, category, status, tracks_completion, target_departments, target_semesters, target_sections, expires_at, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const documents = docsRes.data ?? []
  const students = (studentsRes.data as Student[]) ?? []
  const now = new Date()

  let liveCount = 0
  let draftCount = 0
  let archivedCount = 0
  let completionTrackingCount = 0

  for (const doc of documents) {
    if (doc.status === 'archived' || (doc.expires_at && new Date(doc.expires_at) <= now)) {
      archivedCount++
    } else if (doc.status === 'draft') {
      draftCount++
    } else if (doc.status === 'published') {
      liveCount++
      if (doc.tracks_completion) {
        completionTrackingCount++
      }
    }
  }

  const pendingStudentsCount = students.filter((s) => s.account_status === 'pending').length

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 sm:space-y-10 w-full">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Publish institutional documents, extract structured events, and verify student registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingStudentsCount > 0 && (
            <span className="inline-flex items-center text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-300">
              ⏳ {pendingStudentsCount} Pending Approvals
            </span>
          )}
          <span className="inline-flex items-center text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
            Administrator
          </span>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Documents</p>
          <p className="text-3xl font-extrabold text-[#176b61] tracking-tight">{liveCount}</p>
          <p className="text-[11px] text-slate-400">Targeted to students</p>
        </div>

        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Drafts</p>
          <p className="text-3xl font-extrabold text-amber-700 tracking-tight">{draftCount}</p>
          <p className="text-[11px] text-slate-400">Hidden from students</p>
        </div>

        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Students</p>
          <p className="text-3xl font-extrabold text-amber-600 tracking-tight">{pendingStudentsCount}</p>
          <p className="text-[11px] text-slate-400">Requires verification</p>
        </div>

        <div className="bg-white rounded-xl border border-[#dfe7e3] p-5 space-y-1 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Archived</p>
          <p className="text-3xl font-extrabold text-slate-700 tracking-tight">{archivedCount}</p>
          <p className="text-[11px] text-slate-400">Historical records</p>
        </div>
      </section>

      {/* 1. Student Verification Section */}
      <section className="space-y-4 pt-4 border-t border-gray-200">
        <AdminStudentDirectory students={students} />
      </section>

      {/* 2. Upload Studio Section */}
      <section className="space-y-4 pt-4 border-t border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Institutional Document Publishing Studio</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Upload institutional PDFs across Institute and Study categories. AI suggests metadata, targeting, and candidate events.
          </p>
        </div>

        <AdminUploadForm />
      </section>

      {/* 3. Document Directory with Full Lifecycle & Search */}
      <section className="space-y-4 pt-4 border-t border-gray-200">
        <AdminDocumentDirectory documents={documents} />
      </section>
    </div>
  )
}
