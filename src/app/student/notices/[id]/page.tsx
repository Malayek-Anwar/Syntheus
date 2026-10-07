import { verifyStudentSession } from '@/utils/auth'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { getInstitutionalSignedUrl } from '@/utils/storage'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { NoticeCompletionButton } from '@/components/NoticeCompletionButton'
import { CATEGORY_META, EVENT_TYPE_META } from '@/utils/constants'
import type { AcademicEventType, DocumentCategory } from '@/types/database'

export default async function NoticeInsightPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auth = await verifyStudentSession()

  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth

  // 1. Fetch document
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !doc) {
    notFound()
  }

  // 2. Strict targeting verification
  const isVisible = isDocumentVisibleToStudent(doc, {
    department: student.department,
    semester: student.semester,
    section: student.section,
  })

  if (!isVisible) {
    redirect('/student/notices')
  }

  // 3. Fetch completion status
  const { data: completion } = await supabase
    .from('document_completions')
    .select('completed_at, verified_at')
    .eq('student_id', student.id)
    .eq('document_id', id)
    .maybeSingle()

  // 4. Fetch structured academic events for this document
  const { data: academicEvents } = await supabase
    .from('academic_events')
    .select('*')
    .eq('source_document_id', id)
    .order('starts_at', { ascending: true })

  // 5. Generate secure signed URL for the authoritative PDF
  const signedPdfUrl = (await getInstitutionalSignedUrl(supabase, doc.storage_path, 3600)) || ''

  const categoryKey = doc.category as DocumentCategory
  const catMeta = CATEGORY_META[categoryKey] || { label: doc.category, icon: '📄', group: 'institute' }

  const deptsText = doc.target_departments && doc.target_departments.length > 0
    ? doc.target_departments.join(', ')
    : 'All Departments'

  const semsText = doc.target_semesters && doc.target_semesters.length > 0
    ? `Semesters: ${doc.target_semesters.join(', ')}`
    : 'All Semesters'

  const now = new Date()
  const isExpired = doc.expires_at && new Date(doc.expires_at) <= now

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 w-full animate-in fade-in duration-200">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <Link
          href="/student/notices"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span>←</span>
          <span>Back to Documents</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/student/chat?q=${encodeURIComponent(`Explain "${doc.title}" and highlight important instructions for me.`)}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#edf6f3] hover:bg-[#dceee9] text-[#176b61] text-xs font-semibold rounded-full border border-[#cce5df] shadow-2xs transition-all"
          >
            <span>💬 Ask AI</span>
          </Link>
          {signedPdfUrl && (
            <a
              href={signedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-[#f1f5f3] text-slate-700 text-xs font-semibold rounded-full border border-[#dfe7e3] shadow-2xs transition-all"
            >
              <span>Download PDF</span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Main Container */}
      <article className="bg-white rounded-2xl border border-[#dfe7e3] shadow-xs overflow-hidden divide-y divide-[#dfe7e3]">
        {/* Header */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#edf6f3] text-[#176b61] border border-[#cce5df]">
              <span>{catMeta.icon}</span>
              <span>{catMeta.label}</span>
            </span>

            {isExpired ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                <span>📦</span>
                <span>ARCHIVED / EXPIRED</span>
              </span>
            ) : doc.expires_at ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-[#756843] bg-[#f5f3eb] border border-[#e7dfc5]">
                Valid until {new Date(doc.expires_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
            {doc.title}
          </h1>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 pt-1">
            <span>Published {new Date(doc.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span>·</span>
            <span>Audience: {deptsText} ({semsText})</span>
          </div>

          {doc.tracks_completion && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl px-4 py-3.5 mt-4 bg-[#fffdf8] border border-[#e7dfc5]">
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Completion Status: </span>
                {completion ? (
                  <span className="text-[#176b61] font-semibold">
                    ✓ Marked Completed {completion.verified_at ? '(Verified)' : '(Pending Verification)'}
                  </span>
                ) : (
                  <span>Pending your action</span>
                )}
              </div>
              <NoticeCompletionButton noticeId={id} isCompleted={Boolean(completion)} />
            </div>
          )}
        </div>

        {/* AI Description */}
        {doc.description && (
          <section className="p-6 sm:p-8 bg-[#fbfcfb] space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#176b61] flex items-center gap-1.5">
              <span>✨</span>
              <span>Executive Brief</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
              {doc.description}
            </p>
          </section>
        )}

        {/* Structured Academic Events */}
        {academicEvents && academicEvents.length > 0 && (
          <section className="p-6 sm:p-8 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📅</span>
              <span>Structured Events & Critical Dates</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {academicEvents.map((ev) => {
                const meta = EVENT_TYPE_META[ev.event_type as AcademicEventType] || {
                  label: ev.event_type,
                  icon: '📌',
                }
                return (
                  <div key={ev.id} className="p-4 rounded-xl border border-[#dfe7e3] bg-[#fbfcfb] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900">{ev.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#edf6f3] text-[#176b61] flex-shrink-0">
                        {meta.label}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2">{ev.description}</p>
                    )}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 font-mono">
                      <span>{new Date(ev.starts_at).toLocaleDateString()}</span>
                      {ev.ends_at && <span>→ {new Date(ev.ends_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Original Document Viewer */}
        {signedPdfUrl && (
          <section className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📄</span>
                <span>Authoritative Document Viewer</span>
              </h2>
              <a
                href={signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#176b61] hover:text-[#12564f] underline inline-flex items-center gap-1"
              >
                Open in Full Screen ↗
              </a>
            </div>

            <div className="w-full h-[650px] rounded-xl border border-[#dfe7e3] bg-slate-50 overflow-hidden shadow-inner">
              <iframe
                src={signedPdfUrl}
                className="w-full h-full border-0"
                title={doc.title}
              />
            </div>
          </section>
        )}
      </article>
    </div>
  )
}
