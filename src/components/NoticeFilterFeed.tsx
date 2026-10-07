'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { isNoticeDeadlinePassed } from '@/utils/deadlines'
import { CATEGORY_META } from '@/utils/constants'
import type { DocumentCategory } from '@/types/database'

export interface DocumentItem {
  id: string
  title: string
  category?: string | null
  doc_type?: string | null
  summary?: string | null
  deadline?: string | null
  starts_at?: string | null
  priority?: string | null
  audience?: string | null
  target_departments?: string[] | null
  target_semesters?: number[] | null
  file_url: string
  created_at: string
}

interface NoticeFilterFeedProps {
  documents: DocumentItem[]
  defaultTab?: string
  showSearch?: boolean
  title?: string
}

type FilterTabKey = 
  | 'all' 
  | 'deadlines' 
  | 'fee_notice' 
  | 'academic_calendar' 
  | 'exam_circular' 
  | 'holiday_notice' 
  | 'academic_notes' 
  | 'general_notice'

interface TabOption {
  key: FilterTabKey
  label: string
}

const TABS: TabOption[] = [
  { key: 'all', label: 'All Notices' },
  { key: 'deadlines', label: 'Deadlines' },
  { key: 'fee_notice', label: 'Fee & Dues' },
  { key: 'academic_calendar', label: 'Calendars & Schedules' },
  { key: 'exam_circular', label: 'Exams' },
  { key: 'holiday_notice', label: 'Holidays' },
  { key: 'academic_notes', label: 'Syllabus & Notes' },
  { key: 'general_notice', label: 'General' },
]

const DOC_TYPE_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  fee_notice: { label: 'Fee & Dues', bg: 'bg-[#edf6f3]', text: 'text-[#176b61]', border: 'border-[#cce5df]' },
  academic_calendar: { label: 'Academic Calendar', bg: 'bg-[#eef4f3]', text: 'text-[#35635d]', border: 'border-[#d5e5e1]' },
  holiday_notice: { label: 'Holiday Notice', bg: 'bg-[#f5f3eb]', text: 'text-[#756843]', border: 'border-[#e7dfc5]' },
  academic_notes: { label: 'Class Notes', bg: 'bg-[#f0f3f1]', text: 'text-[#50635e]', border: 'border-[#d9e2df]' },
  exam_circular: { label: 'Exam Circular', bg: 'bg-[#f7f0ed]', text: 'text-[#8a5b4e]', border: 'border-[#ead8d1]' },
  general_notice: { label: 'General Notice', bg: 'bg-[#eef4f3]', text: 'text-[#35635d]', border: 'border-[#d5e5e1]' },
}

export function NoticeFilterFeed({
  documents = [],
  defaultTab = 'all',
  showSearch = true,
  title,
}: NoticeFilterFeedProps) {
  const [activeTab, setActiveTab] = useState<FilterTabKey>(defaultTab as FilterTabKey)
  const [searchQuery, setSearchQuery] = useState('')

  // Compute counts for each tab
  const counts = useMemo(() => {
    const countsMap: Record<FilterTabKey, number> = {
      all: documents.length,
      deadlines: 0,
      fee_notice: 0,
      academic_calendar: 0,
      exam_circular: 0,
      holiday_notice: 0,
      academic_notes: 0,
      general_notice: 0,
    }

    documents.forEach((doc) => {
      const type = doc.doc_type || 'general_notice'
      const titleLower = doc.title.toLowerCase()
      const categoryLower = (doc.category || '').toLowerCase()
      const hasPassed = isNoticeDeadlinePassed(doc.deadline)

      // Active Deadlines (upcoming only)
      if ((doc.deadline && !hasPassed) || (!doc.deadline && doc.priority?.toLowerCase() === 'high')) {
        countsMap.deadlines++
      }

      // Exact or fallback matching for types
      if (type === 'fee_notice' || categoryLower === 'fees' || titleLower.includes('fee') || categoryLower.includes('fee') || titleLower.includes('dues')) {
        countsMap.fee_notice++
      }
      if (type === 'academic_calendar' || categoryLower === 'calendar' || categoryLower === 'schedule' || titleLower.includes('calendar') || titleLower.includes('schedule') || categoryLower.includes('calendar')) {
        countsMap.academic_calendar++
      }
      if (type === 'exam_circular' || titleLower.includes('exam') || titleLower.includes('admit') || categoryLower.includes('exam')) {
        countsMap.exam_circular++
      }
      if (type === 'holiday_notice' || titleLower.includes('holiday') || titleLower.includes('closure') || categoryLower.includes('holiday')) {
        countsMap.holiday_notice++
      }
      if (type === 'academic_notes' || categoryLower === 'syllabus' || categoryLower === 'notes' || titleLower.includes('note') || titleLower.includes('syllabus') || categoryLower.includes('note')) {
        countsMap.academic_notes++
      }
      if (type === 'general_notice' || countsMap[type as FilterTabKey] === undefined) {
        countsMap.general_notice++
      }
    })

    return countsMap
  }, [documents])

  // Filter list by tab & search query
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // 1. Tab filtering
      const type = doc.doc_type || 'general_notice'
      const titleLower = doc.title.toLowerCase()
      const categoryLower = (doc.category || '').toLowerCase()
      const hasPassed = isNoticeDeadlinePassed(doc.deadline)

      let tabMatch = true
      if (activeTab === 'deadlines') {
        tabMatch = Boolean((doc.deadline && !hasPassed) || (!doc.deadline && doc.priority?.toLowerCase() === 'high'))
      } else if (activeTab === 'fee_notice') {
        tabMatch = type === 'fee_notice' || titleLower.includes('fee') || categoryLower.includes('fee') || titleLower.includes('dues')
      } else if (activeTab === 'academic_calendar') {
        tabMatch = type === 'academic_calendar' || titleLower.includes('calendar') || titleLower.includes('schedule') || categoryLower.includes('calendar')
      } else if (activeTab === 'exam_circular') {
        tabMatch = type === 'exam_circular' || titleLower.includes('exam') || titleLower.includes('admit') || categoryLower.includes('exam')
      } else if (activeTab === 'holiday_notice') {
        tabMatch = type === 'holiday_notice' || titleLower.includes('holiday') || titleLower.includes('closure') || categoryLower.includes('holiday')
      } else if (activeTab === 'academic_notes') {
        tabMatch = type === 'academic_notes' || titleLower.includes('note') || titleLower.includes('syllabus') || categoryLower.includes('note')
      } else if (activeTab === 'general_notice') {
        const isMappedOther = ['fee_notice', 'academic_calendar', 'exam_circular', 'holiday_notice', 'academic_notes'].includes(type)
        tabMatch = type === 'general_notice' || !isMappedOther
      }

      if (!tabMatch) return false

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = titleLower.includes(q)
        const matchCategory = categoryLower.includes(q)
        const matchSummary = (doc.summary || '').toLowerCase().includes(q)
        const matchAudience = (doc.audience || '').toLowerCase().includes(q)
        const matchDept = (doc.target_departments || []).some(d => d.toLowerCase().includes(q))
        return matchTitle || matchCategory || matchSummary || matchAudience || matchDept
      }

      return true
    })
  }, [documents, activeTab, searchQuery])

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {title ? (
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
        ) : <div />}

        {showSearch && (
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search circulars by keyword..."
              className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl bg-white border border-gray-300 shadow-2xs focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] transition-all placeholder:text-gray-400"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[#dfe7e3]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const count = counts[tab.key] || 0

          // Hide tabs with 0 count except 'all' and 'deadlines'
          if (count === 0 && tab.key !== 'all' && tab.key !== 'deadlines') {
            return null
          }

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#176b61] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-[#edf6f3] bg-white border border-[#dfe7e3]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Feed List */}
      {filteredDocs.length > 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-[#dfe7e3] overflow-hidden divide-y divide-[#dfe7e3]">
          {filteredDocs.map((doc) => {
            const catMeta = doc.category && (doc.category in CATEGORY_META)
              ? CATEGORY_META[doc.category as DocumentCategory]
              : null
            const docTypeKey = doc.doc_type || 'general_notice'
            const typeMeta = DOC_TYPE_META[docTypeKey] || DOC_TYPE_META.general_notice
            const badgeLabel = catMeta ? `${catMeta.icon} ${catMeta.label}` : typeMeta.label
            const depts = doc.target_departments && doc.target_departments.length > 0 && !doc.target_departments.includes('All')
              ? doc.target_departments.join(', ')
              : 'Campus Wide'

            return (
              <div
                key={doc.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfcfb] transition-colors group"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#176b61]">
                      {badgeLabel}
                    </span>

                    {doc.priority?.toLowerCase() === 'high' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-200">
                        URGENT
                      </span>
                    )}

                    {doc.deadline && (
                      isNoticeDeadlinePassed(doc.deadline) ? (
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          Deadline passed · {new Date(doc.deadline).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-[#756843] bg-[#f5f3eb] px-2 py-0.5 rounded-full border border-[#e7dfc5]">
                          Due {new Date(doc.deadline).toLocaleDateString()}
                        </span>
                      )
                    )}
                  </div>

                  <Link
                    href={`/student/notices/${doc.id}`}
                    className="block focus:outline-none"
                  >
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-[#176b61] transition-colors leading-snug">
                      {doc.title}
                    </h3>
                  </Link>

                  {doc.summary && (
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {doc.summary}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 pt-0.5">
                    <span className="text-slate-600 font-medium">{depts}</span>
                    {doc.target_semesters && doc.target_semesters.length > 0 && (
                      <span>· Sem {doc.target_semesters.join(', ')}</span>
                    )}
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end flex-shrink-0 pt-2 sm:pt-0 sm:pl-4">
                  <Link
                    href={`/student/notices/${doc.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#edf6f3] hover:bg-[#dceee9] border border-[#cce5df] text-[#176b61] text-xs font-semibold rounded-full shadow-2xs transition-all"
                  >
                    <span>Read circular</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed space-y-3">
          <span className="text-3xl">🔍</span>
          <h3 className="text-sm font-bold text-gray-900">No matching circulars found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery 
              ? `No circulars matching "${searchQuery}" in this category.` 
              : 'There are currently no circulars in this section.'}
          </p>
          {(activeTab !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setActiveTab('all')
                setSearchQuery('')
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#176b61] hover:text-[#12564f] underline pt-1"
            >
              Reset filters & show all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
