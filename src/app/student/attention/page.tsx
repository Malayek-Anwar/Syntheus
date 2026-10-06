import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { isNoticeArchived } from '@/utils/deadlines'
import { UrgentNoticeCard } from '@/components/UrgentNoticeCard'
import Link from 'next/link'

export default async function StudentAttentionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
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

  const { data: completions } = await supabase
    .from('notice_completions')
    .select('notice_id')
    .eq('user_id', user?.id || '')

  const completedNoticeIds = new Set((completions ?? []).map((completion) => completion.notice_id))

  const now = new Date()
  const allAttentionDocuments = (allDocuments ?? [])
    .filter((doc) => isAudienceVisibleToStudent(doc, studentDept, studentSem))
    .filter((doc) => !doc.starts_at || new Date(doc.starts_at).getTime() <= now.getTime())
    .filter((doc) => Boolean(doc.deadline) || doc.priority?.toLowerCase() === 'high')
    .sort((left, right) => {
      const leftDate = left.deadline ? new Date(left.deadline).getTime() : Number.MAX_SAFE_INTEGER
      const rightDate = right.deadline ? new Date(right.deadline).getTime() : Number.MAX_SAFE_INTEGER
      return leftDate - rightDate
    })

  // Past deadline notices are automatically archived and removed from active attention
  const documents = allAttentionDocuments.filter((doc) => {
    if (view === 'completed') {
      return completedNoticeIds.has(doc.id)
    }
    return !completedNoticeIds.has(doc.id) && !isNoticeArchived(doc, now)
  })

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Attention</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {view === 'completed'
              ? 'Finished attention items.'
              : 'Active deadlines and urgent notices requiring action.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/student/attention"
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all shadow-2xs ${
              view !== 'completed'
                ? 'bg-[#176b61] text-white border-[#176b61]'
                : 'bg-white hover:bg-[#edf6f3] text-slate-700 border-[#dfe7e3]'
            }`}
          >
            Active
          </Link>
          <Link
            href="/student/attention?view=completed"
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all shadow-2xs ${
              view === 'completed'
                ? 'bg-[#176b61] text-white border-[#176b61]'
                : 'bg-white hover:bg-[#edf6f3] text-slate-700 border-[#dfe7e3]'
            }`}
          >
            Completed
          </Link>
          <Link
            href="/student/archive"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#dfe7e3] bg-white hover:bg-slate-100 text-slate-700 transition-all shadow-2xs flex items-center gap-1"
          >
            <span>📦</span>
            <span>Past Archive →</span>
          </Link>
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} · Semester {studentSem}
          </span>
        </div>
      </div>

      {documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {documents.map((doc) => (
            <UrgentNoticeCard
              key={doc.id}
              id={doc.id}
              title={doc.title}
              category={doc.category}
              deadline={doc.deadline}
              starts_at={doc.starts_at}
              target_departments={doc.target_departments}
              target_semesters={doc.target_semesters}
              audience={doc.audience}
              file_url={doc.file_url}
              priority={doc.priority}
              isCompleted={view === 'completed'}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#cce5df] bg-[#f4faf8] px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-gray-900">{view === 'completed' ? 'No completed items yet' : 'You are all caught up'}</h2>
          <p className="text-sm text-gray-500 mt-1">{view === 'completed' ? 'Finished attention items will appear here.' : 'There are no deadlines or priority notices for you right now.'}</p>
        </div>
      )}
    </div>
  )
}