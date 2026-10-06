import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { isNoticeArchived } from '@/utils/deadlines'
import { UrgentNoticeCard } from '@/components/UrgentNoticeCard'
import { NoticeFilterFeed } from '@/components/NoticeFilterFeed'
import Link from 'next/link'

export default async function StudentHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rawDept = user?.user_metadata?.department || 'CSE'
  const rawSem = user?.user_metadata?.semester || 'Semester 1'

  const { target_departments: studentDepts, target_semesters: studentSems } = normalizeAudience(rawDept, rawSem)
  const studentDept = studentDepts[0] || 'CSE'
  const studentSem = studentSems[0] || 1

  // Fetch all published documents and filter strictly with canonical audience visibility rules
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

  const documents = (allDocuments ?? []).filter((doc) =>
    isAudienceVisibleToStudent(doc, studentDept, studentSem)
  )

  const now = new Date()

  // Auto-remove notices whose deadlines have passed from the active dashboard
  const activeDocs = documents.filter((doc) => !isNoticeArchived(doc, now))
  const archivedDocs = documents.filter((doc) => isNoticeArchived(doc, now))

  // Keep Home action-oriented: upcoming deadlines belong in Attention, recent informational notices below
  const attentionDocs = activeDocs.filter((doc) => {
    const startsAt = doc.starts_at ? new Date(doc.starts_at).getTime() : Number.NaN
    const isOpen = Number.isNaN(startsAt) || startsAt <= now.getTime()
    return !completedNoticeIds.has(doc.id) && isOpen && (Boolean(doc.deadline) || doc.priority?.toLowerCase() === 'high')
  })
    .sort((left, right) => {
      const leftDate = left.deadline ? new Date(left.deadline).getTime() : Number.MAX_SAFE_INTEGER
      const rightDate = right.deadline ? new Date(right.deadline).getTime() : Number.MAX_SAFE_INTEGER
      return leftDate - rightDate
    })

  const recentDocs = activeDocs
    .filter((doc) => !attentionDocs.some((attentionDoc) => attentionDoc.id === doc.id))
    .slice(0, 6)

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 sm:space-y-10 w-full">
      {/* Clean Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Student Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Live campus updates, urgent deadlines, and targeted academic circulars.</p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} · Semester {studentSem}
          </span>
        </div>
      </div>

      {/* 1. Attention preview */}
      {attentionDocs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Attention</h2>
              <p className="text-xs text-gray-500 mt-0.5">Deadlines and notices that may need action.</p>
            </div>
            <Link href="/student/attention" className="text-xs font-semibold text-[#176b61] hover:text-[#12564f]">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {attentionDocs.slice(0, 4).map((doc) => (
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
                isCompleted={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Recent informational notices */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Notices</h2>
            <p className="text-xs text-gray-500 mt-0.5">Recent institutional information for you.</p>
          </div>
          <Link href="/student/notices" className="text-xs font-semibold text-[#176b61] hover:text-[#12564f]">
            View all
          </Link>
        </div>
        <NoticeFilterFeed documents={recentDocs} defaultTab="all" showSearch={false} />
      </section>

      {/* 3. Archive Callout Banner */}
      {archivedDocs.length > 0 && (
        <section className="p-4 sm:p-5 rounded-2xl bg-white border border-[#dfe7e3] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#edf6f3] text-[#176b61] border border-[#cce5df] flex items-center justify-center text-lg flex-shrink-0">
              📦
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {archivedDocs.length} Notice{archivedDocs.length > 1 ? 's' : ''} with passed deadlines archived
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Past notices are automatically removed from your dashboard and preserved in the archive for your reference.
              </p>
            </div>
          </div>

          <Link
            href="/student/archive"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#edf6f3] hover:bg-[#dceee9] text-[#176b61] text-xs font-semibold rounded-full border border-[#cce5df] transition-all shadow-2xs whitespace-nowrap self-start sm:self-auto"
          >
            <span>Browse Archive</span>
            <span>→</span>
          </Link>
        </section>
      )}
    </div>
  )
}
