import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { NoticeFilterFeed } from '@/components/NoticeFilterFeed'

export default async function InstitutionalNoticesPage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth
  const now = new Date()

  const { data: allDocuments } = await supabase
    .from('documents')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const documents = (allDocuments ?? []).filter((doc) =>
    isDocumentVisibleToStudent(doc, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    }) &&
    (!doc.expires_at || new Date(doc.expires_at) > now)
  )

  const studentDept = student.department || 'Campus Wide'
  const studentSem = student.semester || 1

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Institutional Documents & Circulars
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative institutional publications, syllabi, fee circulars, and study resources.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} • Semester {studentSem}
          </span>
        </div>
      </div>

      <NoticeFilterFeed
        documents={documents.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          summary: d.description,
          deadline: d.expires_at,
          target_departments: d.target_departments,
          target_semesters: d.target_semesters,
          created_at: d.created_at,
        }))}
        defaultTab="all"
        showSearch={true}
      />
    </div>
  )
}
