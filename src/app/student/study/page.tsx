import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { STUDY_CATEGORIES } from '@/utils/constants'
import { StudyResourceFeed, type StudyItem } from '@/components/StudyResourceFeed'
import type { StudyCategory } from '@/types/database'

export default async function StudentStudyPage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth
  const now = new Date()

  // Fetch published documents that belong to the 5 study categories
  const { data: allStudyDocs } = await supabase
    .from('documents')
    .select('*')
    .eq('status', 'published')
    .in('category', STUDY_CATEGORIES)
    .order('created_at', { ascending: false })

  const visibleDocs = (allStudyDocs ?? []).filter(
    (doc) =>
      isDocumentVisibleToStudent(doc, {
        department: student.department,
        semester: student.semester,
        section: student.section,
      }) &&
      (!doc.expires_at || new Date(doc.expires_at) > now)
  )

  const items: StudyItem[] = visibleDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category as StudyCategory,
    description: doc.description,
    target_departments: doc.target_departments,
    target_semesters: doc.target_semesters,
    target_sections: doc.target_sections,
    created_at: doc.created_at,
  }))

  const studentDept = student.department || 'Campus Wide'
  const studentSem = student.semester || 1

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>📚</span> Study Resources & Course Materials
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access authorized lecture notes, reference textbooks, past question papers, and assignments.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} • Sem {studentSem}
          </span>
        </div>
      </div>

      <StudyResourceFeed documents={items} />
    </div>
  )
}
