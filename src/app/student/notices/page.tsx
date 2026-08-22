import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { NoticeFilterFeed } from '@/components/NoticeFilterFeed'

export default async function InstitutionalNoticesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rawDept = user?.user_metadata?.department || 'CSE'
  const rawSem = user?.user_metadata?.semester || 'Semester 1'

  const { target_departments: studentDepts, target_semesters: studentSems } = normalizeAudience(rawDept, rawSem)
  const studentDept = studentDepts[0] || 'CSE'
  const studentSem = studentSems[0] || 1

  const { data: allDocuments } = await supabase
    .from('documents')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Filter so students only see documents targeted for:
  // 1. User's specific department AND semester
  // 2. All semesters of user's department
  // 3. User's semester across all departments
  // 4. All departments and all semesters (Campus Wide)
  // A student will NOT see documents meant for a different semester in a different department.
  const documents = (allDocuments ?? []).filter((doc) =>
    isAudienceVisibleToStudent(doc, studentDept, studentSem)
  )

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Institutional Notices & Circulars</h1>
          <p className="text-sm text-gray-500 mt-1">Verified academic circulars, fee notifications, exam schedules, and department briefs.</p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
            {studentDept} • Semester {studentSem}
          </span>
        </div>
      </div>

      <NoticeFilterFeed 
        documents={documents} 
        defaultTab="all" 
        showSearch={true} 
      />
    </div>
  )
}
