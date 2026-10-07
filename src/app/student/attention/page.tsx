import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { UrgentNoticeCard } from '@/components/UrgentNoticeCard'
import Link from 'next/link'
import { EVENT_TYPE_META } from '@/utils/constants'
import type { AcademicEventType } from '@/types/database'

export default async function StudentAttentionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const auth = await verifyStudentSession()

  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth
  const now = new Date()

  // 1. Fetch documents that track completion or have upcoming cutoffs
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

  const visibleDocuments = (allDocuments ?? []).filter((doc) =>
    isDocumentVisibleToStudent(doc, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    }) &&
    (!doc.expires_at || new Date(doc.expires_at) > now)
  )

  // Filter based on active vs completed view
  const documents = visibleDocuments.filter((doc) => {
    if (!doc.tracks_completion) return false
    if (view === 'completed') {
      return completedDocIds.has(doc.id)
    }
    return !completedDocIds.has(doc.id)
  })

  // 3. Fetch structured deadline events
  const { data: deadlineEvents } = await supabase
    .from('academic_events')
    .select('*')
    .gte('starts_at', now.toISOString())
    .in('event_type', ['assignment_deadline', 'registration_deadline', 'exam', 'scholarship_deadline', 'admission_deadline'])
    .order('starts_at', { ascending: true })
    .limit(10)

  const visibleEvents = (deadlineEvents ?? []).filter((ev) =>
    isDocumentVisibleToStudent(ev, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    })
  )

  const studentDept = student.department || 'Campus'
  const studentSem = student.semester || 1

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Attention Required</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {view === 'completed'
              ? 'Documents you have marked as completed.'
              : 'Active institutional tasks, deadlines, and participation requirements.'}
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
            Active Tasks
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
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} · Sem {studentSem}
          </span>
        </div>
      </div>

      {/* Structured Deadlines Strip (visible on active view) */}
      {view !== 'completed' && visibleEvents.length > 0 && (
        <section className="p-4 rounded-xl border border-[#e7dfc5] bg-[#fffdf8] space-y-2">
          <span className="text-xs font-bold text-[#756843] uppercase tracking-wider block">
            ⏰ Impending Academic Event Deadlines
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {visibleEvents.map((ev) => {
              const meta = EVENT_TYPE_META[ev.event_type as AcademicEventType] || { label: ev.event_type, icon: '📌' }
              return (
                <div key={ev.id} className="p-2.5 rounded-lg bg-white border border-[#e7dfc5] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 truncate">{ev.title}</span>
                    <span className="text-[10px] text-[#756843] font-mono">{new Date(ev.starts_at).toLocaleDateString()}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{meta.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {documents.map((doc) => (
            <UrgentNoticeCard
              key={doc.id}
              id={doc.id}
              title={doc.title}
              category={doc.category}
              deadline={doc.expires_at}
              target_departments={doc.target_departments}
              target_semesters={doc.target_semesters}
              file_url={doc.storage_path}
              isCompleted={view === 'completed'}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#cce5df] bg-[#f4faf8] px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-gray-900">
            {view === 'completed' ? 'No completed tasks yet' : 'You are all caught up!'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {view === 'completed'
              ? 'Finished tasks will be logged here.'
              : 'There are no active document completion tasks assigned to you right now.'}
          </p>
        </div>
      )}
    </div>
  )
}