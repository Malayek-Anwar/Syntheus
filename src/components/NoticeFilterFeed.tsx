'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'

export interface DocumentItem {
  id: string
  title: string
  category?: string | null
  doc_type?: string | null
  summary?: string | null
  deadline?: string | null
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
  icon: string
}

const TABS: TabOption[] = [
  { key: 'all', label: 'All Notices', icon: '📄' },
  { key: 'deadlines', label: 'Deadlines & Urgent', icon: '⏳' },
  { key: 'fee_notice', label: 'Fee & Dues', icon: '💳' },
  { key: 'academic_calendar', label: 'Calendars', icon: '📅' },
  { key: 'exam_circular', label: 'Exams', icon: '📝' },
  { key: 'holiday_notice', label: 'Holidays', icon: '🎉' },
  { key: 'academic_notes', label: 'Notes & Syllabus', icon: '📚' },
  { key: 'general_notice', label: 'General', icon: '📢' },
]

const DOC_TYPE_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  fee_notice: { label: 'Fee & Dues', icon: '💳', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  academic_calendar: { label: 'Academic Calendar', icon: '📅', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  holiday_notice: { label: 'Holiday Notice', icon: '🎉', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  academic_notes: { label: 'Class Notes', icon: '📚', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  exam_circular: { label: 'Exam Circular', icon: '📝', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  general_notice: { label: 'General Notice', icon: '📢', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
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

      // Deadlines
      if (doc.deadline || doc.priority?.toLowerCase() === 'high') {
        countsMap.deadlines++
      }

      // Exact or fallback matching for types
      if (type === 'fee_notice' || titleLower.includes('fee') || categoryLower.includes('fee') || titleLower.includes('dues')) {
        countsMap.fee_notice++
      }
      if (type === 'academic_calendar' || titleLower.includes('calendar') || titleLower.includes('schedule') || categoryLower.includes('calendar')) {
        countsMap.academic_calendar++
      }
      if (type === 'exam_circular' || titleLower.includes('exam') || titleLower.includes('admit') || categoryLower.includes('exam')) {
        countsMap.exam_circular++
      }
      if (type === 'holiday_notice' || titleLower.includes('holiday') || titleLower.includes('closure') || categoryLower.includes('holiday')) {
        countsMap.holiday_notice++
      }
      if (type === 'academic_notes' || titleLower.includes('note') || titleLower.includes('syllabus') || categoryLower.includes('note')) {
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

      let tabMatch = true
      if (activeTab === 'deadlines') {
        tabMatch = Boolean(doc.deadline || doc.priority?.toLowerCase() === 'high')
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
        tabMatch = type === 'general_notice'
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
              className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl bg-white border border-gray-300 shadow-2xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-gray-400"
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-gray-200">
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
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 bg-white border border-gray-200/80'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
          {filteredDocs.map((doc) => {
            const docTypeKey = doc.doc_type || 'general_notice'
            const typeMeta = DOC_TYPE_META[docTypeKey] || DOC_TYPE_META.general_notice
            const depts = doc.target_departments && doc.target_departments.length > 0 && !doc.target_departments.includes('All')
              ? doc.target_departments.join(', ')
              : 'Campus Wide'

            return (
              <div
                key={doc.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Archetype Icon pill */}
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${typeMeta.bg} ${typeMeta.text} border ${typeMeta.border}`}>
                      <span>{typeMeta.icon}</span>
                      <span className="hidden sm:inline">{typeMeta.label}</span>
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/student/notices/${doc.id}`}
                        className="block focus:outline-none group"
                      >
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                          {doc.title}
                        </h3>
                      </Link>

                      {doc.priority?.toLowerCase() === 'high' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200">
                          HIGH
                        </span>
                      )}
                    </div>

                    {doc.summary && (
                      <p className="text-xs text-gray-600 line-clamp-1 italic">
                        {doc.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                      <span className="font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                        {doc.category || 'General'}
                      </span>
                      <span>•</span>
                      <span>{depts}</span>
                      {doc.target_semesters && doc.target_semesters.length > 0 && (
                        <span>• Sem {doc.target_semesters.join(', ')}</span>
                      )}
                      <span>•</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      {doc.deadline && (
                        <>
                          <span>•</span>
                          <span className="text-orange-700 font-medium bg-orange-50 px-1.5 py-0.5 rounded text-[11px] border border-orange-200/60">
                            Due {new Date(doc.deadline).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <Link
                    href={`/student/notices/${doc.id}`}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 text-blue-700 text-xs font-semibold rounded-lg shadow-2xs transition-all"
                  >
                    <span>View Insights</span>
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 underline pt-1"
            >
              Reset filters & show all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
