import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { TimelineMilestone, DocType } from '@/app/admin/actions'

const DOC_TYPE_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  fee_notice: { label: 'Fee & Dues', icon: '💳', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  academic_calendar: { label: 'Academic Calendar', icon: '📅', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  holiday_notice: { label: 'Holiday Notice', icon: '🎉', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  academic_notes: { label: 'Class Notes / Syllabus', icon: '📚', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  exam_circular: { label: 'Exam Circular', icon: '📝', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  general_notice: { label: 'General Notice', icon: '📢', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
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
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full animate-in fade-in duration-200">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-200">
        <Link
          href="/student/notices"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span>←</span> Back to Notices
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/student/chat?q=${encodeURIComponent(`Explain the notice "${doc.title}" and tell me what I should do.`)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 shadow-2xs transition-all"
          >
            <span>💬 Ask AI About This Notice</span>
          </Link>
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 shadow-2xs transition-all"
          >
            <span>Download PDF</span>
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>

      {/* Hero Notice Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${typeMeta.bg} ${typeMeta.text} border ${typeMeta.border}`}>
            <span>{typeMeta.icon}</span>
            <span>{typeMeta.label}</span>
          </span>

          {doc.category && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              {doc.category}
            </span>
          )}

          {doc.priority?.toLowerCase() === 'high' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              HIGH PRIORITY
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-950 tracking-tight leading-snug">
          {doc.title}
        </h1>

        {/* Metadata Footer */}
        <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-700">Target Audience:</span>
            <span>{deptsText} • {semsText}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-700">Published:</span>
            <span>{new Date(doc.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* 1. AI Executive Summary */}
      {doc.summary && (
        <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white rounded-2xl p-6 sm:p-8 border border-blue-200/70 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                ✨
              </span>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">AI Executive Summary</h2>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full border border-blue-200">
              Inferred Intelligence
            </span>
          </div>
          <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
            {doc.summary}
          </p>
        </div>
      )}

      {/* 2. Multi-Stage Timeline / Deadlines Stepper */}
      {displayTimeline.length > 0 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Multi-Stage Timeline & Key Milestones</h2>
            </div>
            <span className="text-xs text-gray-500 font-medium">{displayTimeline.length} Milestone{displayTimeline.length > 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {displayTimeline.map((m, idx) => {
              const mDate = new Date(m.date)
              const isPassed = !isNaN(mDate.getTime()) && mDate < startOfToday
              const isTodayOrUpcoming = !isNaN(mDate.getTime()) && mDate >= startOfToday

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                    isTodayOrUpcoming
                      ? 'bg-blue-50/40 border-blue-200 ring-1 ring-blue-200/50 shadow-2xs'
                      : 'bg-gray-50/60 border-gray-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-gray-900 leading-tight">{m.label}</span>
                    {m.fee_penalty && (
                      <span className="text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded border border-orange-200/60 flex-shrink-0">
                        {m.fee_penalty}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-gray-900">
                      {new Date(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isPassed ? 'text-gray-500 bg-gray-200' : 'text-blue-700 bg-blue-100'
                    }`}>
                      {isPassed ? 'PASSED' : 'ACTIVE / UPCOMING'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Action Checklist & Key Rules Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Action Items */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <h2 className="text-base font-bold text-gray-900">Action Checklist for Students</h2>
          </div>

          {actionItems.length > 0 ? (
            <ul className="space-y-2.5">
              {actionItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-gray-800 bg-gray-50/70 p-3 rounded-xl border border-gray-200/70">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 italic py-2">
              No mandatory action items required. This notice is informational.
            </p>
          )}
        </div>

        {/* Key Rules & Takeaways */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">📌</span>
            <h2 className="text-base font-bold text-gray-900">Key Rules & Important Takeaways</h2>
          </div>

          {keyPoints.length > 0 ? (
            <ul className="space-y-2.5">
              {keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-800">
                  <span className="text-blue-600 font-bold text-sm leading-none mt-1">•</span>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 italic py-2">
              Standard institutional guidelines apply.
            </p>
          )}
        </div>
      </div>

      {/* 4. Instant AI Contextual Q&A */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
              S
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                Ask AI About This Notice
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                  Instant Q&A
                </span>
              </h3>
              <p className="text-xs text-gray-500">Get plain-English answers and clarifications grounded in this circular.</p>
            </div>
          </div>

          <Link
            href={`/student/chat?q=${encodeURIComponent(`I have a question about the notice "${doc.title}": `)}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Open in AI Assistant</span>
            <span>→</span>
          </Link>
        </div>

        {/* Suggested Prompt Chips */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Suggested questions:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {aiQueries.map((query, i) => (
              <Link
                key={i}
                href={`/student/chat?q=${encodeURIComponent(query)}`}
                className="group p-3 rounded-xl bg-gray-50/70 hover:bg-blue-50/60 border border-gray-200 hover:border-blue-300 text-xs text-gray-700 hover:text-blue-900 transition-all shadow-2xs flex items-center justify-between gap-2"
              >
                <span className="leading-snug line-clamp-2">{query}</span>
                <span className="text-gray-400 group-hover:text-blue-600 font-bold flex-shrink-0 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Original Document Viewer Frame */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Original Document Preview</h2>
          </div>
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
          >
            Open in Full Screen ↗
          </a>
        </div>

        <div className="w-full h-[650px] rounded-xl border border-gray-300 bg-gray-50 overflow-hidden shadow-inner">
          <iframe
            src={doc.file_url}
            className="w-full h-full border-0"
            title={doc.title}
          />
        </div>
      </div>
    </div>
  )
}
