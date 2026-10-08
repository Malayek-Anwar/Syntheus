import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { UrgentNoticeCard } from '@/components/UrgentNoticeCard'
import { NoticeFilterFeed } from '@/components/NoticeFilterFeed'
import Link from 'next/link'
import { EVENT_TYPE_META } from '@/utils/constants'
import type { AcademicEventType } from '@/types/database'

export default async function StudentHomePage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth
  const now = new Date()
  const nowIso = now.toISOString()

  // 1. Fetch published documents
  const { data: allDocuments } = await supabase
    .from('documents')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // 2. Fetch completions for this student
  const { data: completions } = await supabase
    .from('document_completions')
    .select('document_id')
    .eq('student_id', student.id)

  const completedDocIds = new Set(
    (completions ?? []).map((c) => c.document_id).filter(Boolean)
  )

  // 3. Filter documents matching student's academic targeting
  const visibleDocuments = (allDocuments ?? []).filter((doc) =>
    isDocumentVisibleToStudent(doc, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    })
  )

  // 4. Split active vs archived by expiration date
  const activeDocs = visibleDocuments.filter(
    (doc) => !doc.expires_at || new Date(doc.expires_at) > now
  )
  const archivedDocs = visibleDocuments.filter(
    (doc) => doc.expires_at && new Date(doc.expires_at) <= now
  )

  // 5. Fetch upcoming academic events from structured table
  const { data: allEvents } = await supabase
    .from('academic_events')
    .select('*')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(20)

  const studentEvents = (allEvents ?? []).filter((ev) =>
    isDocumentVisibleToStudent(ev, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    })
  )

  // Attention: items tracking completion that are pending, or impending cutoff
  const attentionDocs = activeDocs.filter(
    (doc) => doc.tracks_completion && !completedDocIds.has(doc.id)
  )

  const recentDocs = activeDocs
    .filter((doc) => !attentionDocs.some((a) => a.id === doc.id))
    .slice(0, 6)

  const studentDept = student.department || 'All'
  const studentSem = student.semester || 1

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 sm:space-y-10 w-full">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Student Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Verified academic circulars, structured exam events, and targeted institutional documents.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} · Sem {studentSem}
            {student.section ? ` · Sec ${student.section}` : ''}
          </span>
        </div>
      </div>

      {/* 1. Upcoming Structured Academic Events */}
      {studentEvents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📅</span> Upcoming Academic Events & Deadlines
            </h2>
            <Link
              href="/student/calendar"
              className="text-xs font-semibold text-[#176b61] hover:text-[#12564f] hover:underline"
            >
              Full Calendar & Timetable →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {studentEvents.slice(0, 6).map((ev) => {
              const meta = EVENT_TYPE_META[ev.event_type as AcademicEventType] || {
                label: ev.event_type,
                icon: '📌',
              }
              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-xl border border-[#dfe7e3] bg-white shadow-2xs space-y-2 hover:border-[#a9d2c9] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-900 line-clamp-1">{ev.title}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#edf6f3] text-[#176b61] flex items-center gap-1 flex-shrink-0">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 font-mono pt-1 border-t border-gray-100">
                    <span>{new Date(ev.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {ev.all_day && <span className="text-[10px] uppercase font-bold text-gray-400">All Day</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 2. Attention (Pending Completion Documents) */}
      {attentionDocs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Attention Required</h2>
              <p className="text-xs text-gray-500 mt-0.5">Documents requiring participation or action from you.</p>
            </div>
            <Link href="/student/attention" className="text-xs font-semibold text-[#176b61] hover:text-[#12564f]">
              View all ({attentionDocs.length})
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {attentionDocs.slice(0, 4).map((doc) => (
              <UrgentNoticeCard
                key={doc.id}
                id={doc.id}
                title={doc.title}
                category={doc.category}
                deadline={doc.expires_at}
                target_departments={doc.target_departments}
                target_semesters={doc.target_semesters}
                isCompleted={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. Recent Institutional Notices */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">Targeted campus documents and academic updates.</p>
          </div>
          <Link href="/student/notices" className="text-xs font-semibold text-[#176b61] hover:text-[#12564f]">
            Browse all →
          </Link>
        </div>
        <NoticeFilterFeed
          documents={recentDocs.map((d) => ({
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
          showSearch={false}
        />
      </section>

      {/* 4. Archive Banner */}
      {archivedDocs.length > 0 && (
        <section className="p-4 sm:p-5 rounded-2xl bg-white border border-[#dfe7e3] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#edf6f3] text-[#176b61] border border-[#cce5df] flex items-center justify-center text-lg flex-shrink-0">
              📦
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {archivedDocs.length} Expired document{archivedDocs.length > 1 ? 's' : ''} in Archive
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Past documents are automatically kept separate from your active feed and preserved for search.
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
