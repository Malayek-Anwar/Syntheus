import { createClient } from '@/utils/supabase/server'
import { normalizeAudience, isAudienceVisibleToStudent } from '@/utils/audience'
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

  const documents = (allDocuments ?? []).filter((doc) =>
    isAudienceVisibleToStudent(doc, studentDept, studentSem)
  )

  // Split documents into urgentDocs (strictly upcoming deadline within next 14 days) and feedDocs (remaining)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const fourteenDaysFromNow = new Date(startOfToday.getTime() + 14 * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1))

  const urgentDocs: typeof documents = []
  const feedDocs: typeof documents = []

  for (const doc of documents ?? []) {
    let isUrgent = false

    // Strictly deadline check: document must have an upcoming deadline within the next 14 days
    if (doc.deadline) {
      const deadlineDate = new Date(doc.deadline)
      if (!isNaN(deadlineDate.getTime())) {
        const isUpcomingWithin14Days = deadlineDate >= startOfToday && deadlineDate <= fourteenDaysFromNow
        if (isUpcomingWithin14Days) {
          isUrgent = true
        }
      }
    }

    if (isUrgent) {
      urgentDocs.push(doc)
    } else {
      feedDocs.push(doc)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 sm:space-y-10 w-full">
      {/* Clean Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Student Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Live campus updates, urgent deadlines, and targeted academic circulars.</p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
            {studentDept} • Semester {studentSem}
          </span>
        </div>
      </div>

      {/* 1. Urgent Notices Section (Rendered at top with UrgentNoticeCard) */}
      {urgentDocs && urgentDocs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Urgent Notices & Deadlines</h2>
            <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full border border-red-200">
              {urgentDocs.length} Action{urgentDocs.length > 1 ? 's' : ''} Required
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {urgentDocs.map((doc) => (
              <UrgentNoticeCard
                key={doc.id}
                id={doc.id}
                title={doc.title}
                category={doc.category}
                deadline={doc.deadline}
                target_departments={doc.target_departments}
                target_semesters={doc.target_semesters}
                audience={doc.audience}
                file_url={doc.file_url}
                priority={doc.priority}
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. Personalized Feed with Interactive Filter Tabs */}
      <section className="space-y-4">
        <NoticeFilterFeed
          documents={feedDocs}
          title="Your Personalized Feed"
          defaultTab="all"
          showSearch={true}
        />
      </section>
    </div>
  )
}
