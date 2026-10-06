import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { isNoticeDeadlinePassed } from '@/utils/deadlines'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { TimelineMilestone, DocType } from '@/app/admin/actions'
import { NoticeCompletionButton } from '@/components/NoticeCompletionButton'

const DOC_TYPE_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  fee_notice: { label: 'Fee & Dues', icon: '💳', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  academic_calendar: { label: 'Academic Calendar', icon: '📅', bg: 'bg-[#eef4f3]', text: 'text-[#35635d]', border: 'border-[#d5e5e1]' },
  holiday_notice: { label: 'Holiday Notice', icon: '🎉', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  academic_notes: { label: 'Class Notes / Syllabus', icon: '📚', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  exam_circular: { label: 'Exam Circular', icon: '📝', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  general_notice: { label: 'General Notice', icon: '📢', bg: 'bg-[#eef4f3]', text: 'text-[#35635d]', border: 'border-[#d5e5e1]' },
}

export default async function NoticeInsightPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const rawDept = user?.user_metadata?.department || 'CSE'
  const rawSem = user?.user_metadata?.semester || 'Semester 1'

  const { target_departments: studentDepts, target_semesters: studentSems } = normalizeAudience(rawDept, rawSem)
  const studentDept = studentDepts[0] || 'CSE'
  const studentSem = studentSems[0] || 1

  // Fetch document
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !doc) {
    notFound()
  }

  // Strict audience verification
  const isVisible = isAudienceVisibleToStudent(doc, studentDept, studentSem)
  if (!isVisible) {
    redirect('/student/notices')
  }

  const { data: completion } = await supabase
    .from('notice_completions')
    .select('completed_at')
    .eq('user_id', user.id)
    .eq('notice_id', id)
    .maybeSingle()

  // Parse metadata
  const docTypeKey = (doc.doc_type || 'general_notice') as DocType
  const typeMeta = DOC_TYPE_META[docTypeKey] || DOC_TYPE_META.general_notice

  const keyPoints: string[] = Array.isArray(doc.key_points) ? doc.key_points : []
  const actionItems: string[] = Array.isArray(doc.action_items) ? doc.action_items : []
  const timeline: TimelineMilestone[] = Array.isArray(doc.timeline) ? doc.timeline : []

  // If no timeline array exists but a deadline is present, construct a single milestone
  const displayTimeline: TimelineMilestone[] = timeline.length > 0 
    ? timeline 
    : doc.deadline 
    ? [{ label: 'Submission Deadline', date: doc.deadline.split('T')[0], fee_penalty: null, description: 'Final submission cutoff' }]
    : []

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startsAt = doc.starts_at ? new Date(doc.starts_at) : null
  const deadlineDate = doc.deadline ? new Date(doc.deadline) : null
  const isScheduled = startsAt && !isNaN(startsAt.getTime()) && startsAt > now
  const isActionRequired = Boolean(doc.deadline) || doc.priority?.toLowerCase() === 'high'

  const deptsText = doc.target_departments && doc.target_departments.length > 0 && !doc.target_departments.includes('All')
    ? doc.target_departments.join(', ')
    : 'All Departments (Campus Wide)'

  const semsText = doc.target_semesters && doc.target_semesters.length > 0
    ? `Semesters: ${doc.target_semesters.join(', ')}`
    : 'All Semesters'

  // Pre-configured AI question queries
  const aiQueries = [
    `What are the key deadlines and rules in "${doc.title}"?`,
    `Are there any fee penalties or late fines mentioned in "${doc.title}"?`,
    `What action steps do I need to complete for "${doc.title}"?`,
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 w-full animate-in fade-in duration-200">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <Link
          href="/student/notices"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span>←</span>
          <span>Back to Notices</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/student/chat?q=${encodeURIComponent(`Explain the notice "${doc.title}" and tell me what I should do.`)}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#edf6f3] hover:bg-[#dceee9] text-[#176b61] text-xs font-semibold rounded-full border border-[#cce5df] shadow-2xs transition-all"
          >
            <span>💬 Ask AI</span>
          </Link>
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-[#f1f5f3] text-slate-700 text-xs font-semibold rounded-full border border-[#dfe7e3] shadow-2xs transition-all"
          >
            <span>Download PDF</span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>

      {/* Main Document Reader Container */}
      <article className="bg-white rounded-2xl border border-[#dfe7e3] shadow-xs overflow-hidden divide-y divide-[#dfe7e3]">
        {/* Document Header */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${typeMeta.bg} ${typeMeta.text} border ${typeMeta.border}`}>
              <span>{typeMeta.label}</span>
            </span>

            {doc.category && (
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                {doc.category}
              </span>
            )}

            {isNoticeDeadlinePassed(doc.deadline) ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                <span>📦</span>
                <span>ARCHIVED · PAST DEADLINE</span>
              </span>
            ) : doc.priority?.toLowerCase() === 'high' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                HIGH PRIORITY
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

          {isActionRequired && (
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl px-4 py-3.5 mt-4 ${
              isNoticeDeadlinePassed(doc.deadline)
                ? 'bg-slate-50 border border-slate-200'
                : 'bg-[#fffdf8] border border-[#e7dfc5]'
            }`}>
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {isNoticeDeadlinePassed(doc.deadline) ? 'Archive Status: ' : 'Action Status: '}
                </span>
                {isNoticeDeadlinePassed(doc.deadline)
                  ? `The deadline passed on ${deadlineDate?.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}. This circular is preserved in the archive for your reference.`
                  : isScheduled
                    ? `Opens on ${startsAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Active / Requires completion'}
                {!isNoticeDeadlinePassed(doc.deadline) && deadlineDate && (
                  <span className="text-[#756843] font-medium"> · Deadline: {deadlineDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                )}
              </div>
              <NoticeCompletionButton noticeId={id} isCompleted={Boolean(completion)} />
            </div>
          )}
        </div>

        {/* 1. AI Executive Summary */}
        {doc.summary && (
          <section className="p-6 sm:p-8 bg-[#fbfcfb] space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#176b61] flex items-center gap-1.5">
                <span>✨</span>
                <span>Executive Summary</span>
              </h2>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                AI Extracted
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
              {doc.summary}
            </p>
          </section>
        )}

        {/* 2. Process Timeline / Deadlines */}
        {displayTimeline.length > 0 && (
          <section className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>⏳</span>
                <span>Timeline & Critical Cutoffs</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {displayTimeline.length} Milestone{displayTimeline.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {displayTimeline.map((m, idx) => {
                const mDate = new Date(m.date)
                const isPassed = !isNaN(mDate.getTime()) && mDate < startOfToday
                const isTodayOrUpcoming = !isNaN(mDate.getTime()) && mDate >= startOfToday

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-2.5 ${
                      isTodayOrUpcoming
                        ? 'bg-[#edf6f3] border-[#cce5df] shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 leading-tight">{m.label}</span>
                      {m.fee_penalty && (
                        <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200 flex-shrink-0">
                          {m.fee_penalty}
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-800">
                        {new Date(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isPassed ? 'text-slate-500 bg-slate-200' : 'text-[#176b61] bg-[#dceee9]'
                      }`}>
                        {isPassed ? 'PASSED' : 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 3. Action Checklist & Key Rules */}
        <section className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Action Items */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>✅</span>
                <span>Action Checklist</span>
              </h2>

              {actionItems.length > 0 ? (
                <ul className="space-y-2">
                  {actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 bg-[#fbfcfb] p-3 rounded-lg border border-[#dfe7e3]">
                      <span className="w-5 h-5 rounded-full bg-[#edf6f3] text-[#176b61] font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#cce5df]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">
                  No mandatory action items required. This notice is informational.
                </p>
              )}
            </div>

            {/* Key Rules & Takeaways */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>📌</span>
                <span>Key Directives & Rules</span>
              </h2>

              {keyPoints.length > 0 ? (
                <ul className="space-y-2">
                  {keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 bg-[#fbfcfb] p-3 rounded-lg border border-[#dfe7e3]">
                      <span className="text-[#176b61] font-bold text-base leading-none mt-0.5">•</span>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">
                  Standard institutional guidelines apply.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 4. Instant AI Contextual Q&A */}
        <section className="p-6 sm:p-8 bg-[#fbfcfb] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>💬</span>
                <span>Ask AI About This Notice</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Get immediate answers and clarifications grounded in this circular.</p>
            </div>

            <Link
              href={`/student/chat?q=${encodeURIComponent(`I have a question about the notice "${doc.title}": `)}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#176b61] hover:text-[#12564f] transition-colors"
            >
              <span>Open AI Assistant</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {aiQueries.map((query, i) => (
              <Link
                key={i}
                href={`/student/chat?q=${encodeURIComponent(query)}`}
                className="group p-3 rounded-xl bg-white hover:bg-[#edf6f3] border border-[#dfe7e3] hover:border-[#a9d2c9] text-xs text-slate-700 hover:text-[#176b61] transition-all shadow-2xs flex items-center justify-between gap-2"
              >
                <span className="leading-snug line-clamp-2">{query}</span>
                <span className="text-slate-400 group-hover:text-[#176b61] font-bold flex-shrink-0 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 5. Original Document Viewer Frame */}
        <section className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📄</span>
              <span>Original Document Viewer</span>
            </h2>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#176b61] hover:text-[#12564f] underline inline-flex items-center gap-1"
            >
              Open in Full Screen ↗
            </a>
          </div>

          <div className="w-full h-[650px] rounded-xl border border-[#dfe7e3] bg-slate-50 overflow-hidden shadow-inner">
            <iframe
              src={doc.file_url}
              className="w-full h-full border-0"
              title={doc.title}
            />
          </div>
        </section>
      </article>
    </div>
  )
}
