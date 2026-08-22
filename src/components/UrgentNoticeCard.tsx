import React from 'react'
import Link from 'next/link'

export interface UrgentNoticeProps {
  id?: string
  title: string
  category?: string | null
  deadline?: string | Date | null
  target_departments?: string[] | null
  target_semesters?: number[] | null
  audience?: string | null
  file_url: string
  priority?: string | null
}

/**
 * Formats an ISO date string or Date object into human-readable format like "25 August"
 */
function formatDeadline(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return 'Immediate Action'
  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
    if (isNaN(date.getTime())) return String(dateValue)
    
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
    }).format(date)
  } catch {
    return String(dateValue)
  }
}

/**
 * Formats target audience display text e.g. "CSE • Semester 3"
 */
function formatAudience(
  target_departments?: string[] | null,
  target_semesters?: number[] | null,
  fallbackAudience?: string | null
): string {
  const depts = target_departments && target_departments.length > 0 && !target_departments.includes('All')
    ? target_departments.join(', ')
    : 'All Departments'

  const sems = target_semesters && target_semesters.length > 0
    ? (target_semesters.length === 1 ? `Semester ${target_semesters[0]}` : `Semesters ${target_semesters.join(', ')}`)
    : 'All Semesters'

  if (depts === 'All Departments' && sems === 'All Semesters' && fallbackAudience) {
    return fallbackAudience
  }

  return `${depts} • ${sems}`
}

export function UrgentNoticeCard({
  id,
  title,
  category,
  deadline,
  target_departments,
  target_semesters,
  audience,
  file_url,
}: UrgentNoticeProps) {
  const formattedDeadline = formatDeadline(deadline)
  const audienceText = formatAudience(target_departments, target_semesters, audience)
  const noticeUrl = id ? `/student/notices/${id}` : file_url

  return (
    <div className="relative overflow-hidden rounded-xl border border-red-200 bg-gradient-to-br from-red-50/70 via-white to-red-50/30 p-5 shadow-sm hover:shadow-md transition-all border-l-4 border-l-red-600">
      {/* Top Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {/* Action Required Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold tracking-wide text-red-700 border border-red-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            ACTION REQUIRED
          </span>

          {/* Category Badge */}
          {category && (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {category}
            </span>
          )}
        </div>

        {/* Formatted Deadline Badge */}
        {deadline && (
          <div className="flex items-center text-xs font-bold text-red-700 bg-red-100/80 px-2.5 py-1 rounded-md border border-red-200/60">
            <svg className="w-3.5 h-3.5 mr-1.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Due {formattedDeadline}
          </div>
        )}
      </div>

      {/* Main Title */}
      <Link href={noticeUrl} className="block group">
        <h3 className="text-lg font-bold text-gray-900 leading-snug line-clamp-2 mb-3 group-hover:text-red-700 transition-colors">
          {title}
        </h3>
      </Link>

      {/* Footer Info: Targeted Audience & Action Button */}
      <div className="mt-4 pt-3 border-t border-red-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Targeted Audience */}
        <div className="flex items-center text-xs font-medium text-gray-600">
          <svg className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="truncate">{audienceText}</span>
        </div>

        {/* High-Contrast View Notice Button */}
        <Link
          href={noticeUrl}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex-shrink-0"
        >
          <span>View Insights</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
