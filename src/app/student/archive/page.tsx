import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { ArchivedNoticeFeed } from '@/components/ArchivedNoticeFeed'

export default async function StudentArchivePage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth
  const now = new Date()

  // Fetch all archived documents (published but expired, or explicitly archived)
  const { data: allDocuments } = await supabase
    .from('documents')
    .select('*')
    .in('status', ['published', 'archived'])
    .or(`status.eq.archived,expires_at.lte.${now.toISOString()}`)
    .order('created_at', { ascending: false })

  // Fetch completions
  const { data: completions } = await supabase
    .from('document_completions')
    .select('document_id')
    .eq('student_id', student.id)

  const completedDocIds = (completions ?? []).map((c) => c.document_id).filter(Boolean) as string[]

  const visibleDocuments = (allDocuments ?? []).filter((doc) =>
    isDocumentVisibleToStudent(doc, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    })
  )

  const studentDept = student.department || 'Campus'
  const studentSem = student.semester || 1

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Document & Circular Archive</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Historical documents and circulars whose deadlines have passed. Preserved for institutional records and AI search.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} · Sem {studentSem}
          </span>
        </div>
      </div>

      {/* Feed */}
      <ArchivedNoticeFeed
        documents={visibleDocuments.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          summary: d.description,
          deadline: d.expires_at,
          target_departments: d.target_departments,
          target_semesters: d.target_semesters,
          file_url: d.storage_path,
          created_at: d.created_at,
        }))}
        completedNoticeIds={completedDocIds}
      />
    </div>
  )
}
