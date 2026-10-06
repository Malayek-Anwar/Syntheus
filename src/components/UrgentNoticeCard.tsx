import React from 'react'
import Link from 'next/link'
import { NoticeCompletionButton } from '@/components/NoticeCompletionButton'

export interface UrgentNoticeProps {
  id?: string
  title: string
  category?: string | null
  deadline?: string | Date | null
  starts_at?: string | Date | null
  target_departments?: string[] | null
  target_semesters?: number[] | null
  audience?: string | null
  file_url: string
  priority?: string | null
  isCompleted?: boolean
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
  starts_at,
  target_departments,
  target_semesters,
  audience,
  file_url,
  priority,
  isCompleted = false,
}: UrgentNoticeProps) {
  const formattedDeadline = formatDeadline(deadline)
  const audienceText = formatAudience(target_departments, target_semesters, audience)
  const isExternal = !id && (file_url.startsWith('http://') || file_url.startsWith('https://'))
  const noticeUrl = id ? `/student/notices/${id}` : file_url

  const TitleContent = (
    <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-[#176b61] transition-colors">
      {title}
    </h3>
  )

  return (
    <div className="relative flex flex-col justify-between h-full overflow-hidden rounded-xl border border-[#e7dfc5] bg-[#fffdf8] p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-[#b79d58]">
      {/* Top and Body Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Action Required Badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f3eb] px-2.5 py-1 text-xs font-semibold tracking-wide text-[#756843] border border-[#e7dfc5] shadow-2xs flex-shrink-0">
              <span className="h-2 w-2 rounded-full bg-[#b79d58]" />
              UPCOMING DEADLINE
            </span>

            {priority?.toLowerCase() === 'high' && (
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-xs font-bold border border-red-200">
                URGENT
              </span>
            )}

            {/* Category Badge */}
            {category && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 truncate">
                {category}
              </span>
            )}
          </div>

          {/* Formatted Deadline Badge */}
          {deadline && (
            <div className="flex items-center text-xs font-semibold text-[#756843] bg-[#f5f3eb] px-2.5 py-1 rounded-full border border-[#e7dfc5] flex-shrink-0 whitespace-nowrap">
              <svg className="w-3.5 h-3.5 mr-1.5 text-[#b79d58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Due {formattedDeadline}
            </div>
          )}
          {!deadline && starts_at && (
            <div className="flex items-center text-xs font-semibold text-[#35635d] bg-[#eef4f3] px-2.5 py-1 rounded-full border border-[#d5e5e1] flex-shrink-0 whitespace-nowrap">
              Opens {new Date(starts_at).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Main Title Link */}
        {isExternal ? (
          <a href={file_url} target="_blank" rel="noopener noreferrer" className="block group mb-3">
            {TitleContent}
          </a>
        ) : (
          <Link href={noticeUrl} className="block group mb-3">
            {TitleContent}
          </Link>
        )}
      </div>

      {/* Footer Info: Targeted Audience & Action Button */}
      <div className="mt-auto pt-3.5 border-t border-[#eee8d6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Targeted Audience */}
        <div className="flex items-center text-xs font-medium text-gray-600 min-w-0 flex-1">
          <svg className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="truncate">{audienceText}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 flex-shrink-0">
          {id && <NoticeCompletionButton noticeId={id} isCompleted={isCompleted} />}
          {isExternal ? (
            <a
              href={file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#176b61] hover:bg-[#12564f] shadow-xs hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-[#72b5aa] focus:ring-offset-2"
            >
              <span>Open document</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <Link
              href={noticeUrl}
              className="inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#176b61] hover:bg-[#12564f] shadow-xs hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-[#72b5aa] focus:ring-offset-2"
            >
              <span>Open notice</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
