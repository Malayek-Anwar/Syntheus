import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { isNoticeArchived } from '@/utils/deadlines'
import { ArchivedNoticeFeed } from '@/components/ArchivedNoticeFeed'

export default async function StudentArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rawDept = user?.user_metadata?.department || 'CSE'
  const rawSem = user?.user_metadata?.semester || 'Semester 1'

  const { target_departments: studentDepts, target_semesters: studentSems } = normalizeAudience(rawDept, rawSem)
  const studentDept = studentDepts[0] || 'CSE'
  const studentSem = studentSems[0] || 1

  // Fetch all published documents
  const { data: allDocuments } = await supabase
    .from('documents')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Fetch completions
  const { data: completions } = await supabase
    .from('notice_completions')
    .select('notice_id')
    .eq('user_id', user?.id || '')

  const completedNoticeIds = (completions ?? []).map((c) => c.notice_id)
  const completedSet = new Set(completedNoticeIds)

  const visibleDocuments = (allDocuments ?? []).filter((doc) =>
    isAudienceVisibleToStudent(doc, studentDept, studentSem)
  )

  const now = new Date()

  // Archived documents are documents whose deadline has passed, or are admin-archived,
  // or that the student has marked as completed.
  const archivedDocuments = visibleDocuments.filter(
    (doc) => isNoticeArchived(doc, now) || completedSet.has(doc.id)
  )

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full animate-in fade-in duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Notice & Circular Archive</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Historical circulars and notices whose deadlines have passed. Automatically archived and preserved for verification and AI search.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} · Semester {studentSem}
          </span>
        </div>
      </div>

      {/* Feed */}
      <ArchivedNoticeFeed
        documents={archivedDocuments}
        completedNoticeIds={completedNoticeIds}
      />
    </div>
  )
}
