'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import type { DocumentItem } from './NoticeFilterFeed'
import { isNoticeDeadlinePassed } from '@/utils/deadlines'

interface ArchivedNoticeFeedProps {
  documents: DocumentItem[]
  completedNoticeIds?: string[]
}

const ARCHIVE_CATEGORIES = [
  { key: 'all', label: 'All Archived' },
  { key: 'deadlines', label: 'Past Deadlines' },
  { key: 'completed', label: 'Marked Completed' },
  { key: 'fee_notice', label: 'Fee Circulars' },
  { key: 'exam_circular', label: 'Exams' },
  { key: 'general_notice', label: 'General' },
]

export function ArchivedNoticeFeed({
  documents = [],
  completedNoticeIds = [],
}: ArchivedNoticeFeedProps) {
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const completedSet = useMemo(() => new Set(completedNoticeIds), [completedNoticeIds])

  // Filter list by tab & search query
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const isCompleted = completedSet.has(doc.id)
      const type = doc.doc_type || 'general_notice'
      const titleLower = doc.title.toLowerCase()
      const categoryLower = (doc.category || '').toLowerCase()

      // Tab filtering
      if (activeTab === 'deadlines') {
        if (!doc.deadline || !isNoticeDeadlinePassed(doc.deadline)) return false
      } else if (activeTab === 'completed') {
        if (!isCompleted) return false
      } else if (activeTab === 'fee_notice') {
        const isFee = type === 'fee_notice' || titleLower.includes('fee') || categoryLower.includes('fee')
        if (!isFee) return false
      } else if (activeTab === 'exam_circular') {
        const isExam = type === 'exam_circular' || titleLower.includes('exam') || categoryLower.includes('exam')
        if (!isExam) return false
      } else if (activeTab === 'general_notice') {
        const isMappedOther = ['fee_notice', 'exam_circular'].includes(type)
        if (isMappedOther) return false
      }

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = titleLower.includes(q)
        const matchCategory = categoryLower.includes(q)
        const matchSummary = (doc.summary || '').toLowerCase().includes(q)
        const matchAudience = (doc.audience || '').toLowerCase().includes(q)
        return matchTitle || matchCategory || matchSummary || matchAudience
      }

      return true
    })
  }, [documents, activeTab, searchQuery, completedSet])

  return (
    <div className="space-y-4">
      {/* Top Search & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {filteredDocs.length} Archived Circular{filteredDocs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archive..."
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl bg-white border border-[#dfe7e3] shadow-2xs focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] transition-all placeholder:text-gray-400"
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
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[#dfe7e3]">
        {ARCHIVE_CATEGORIES.map((cat) => {
          const isActive = activeTab === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-[#dfe7e3]'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Archived Notice List */}
      {filteredDocs.length > 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-[#dfe7e3] overflow-hidden divide-y divide-[#dfe7e3]">
          {filteredDocs.map((doc) => {
            const isCompleted = completedSet.has(doc.id)
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
                    <span className="text-xs font-semibold text-slate-500">
                      {doc.category || 'Institutional Notice'}
                    </span>

                    {/* Archived Status Badges */}
                    {doc.deadline && (
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        Deadline passed: {new Date(doc.deadline).toLocaleDateString()}
                      </span>
                    )}

                    {isCompleted && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                        ✓ FINISHED
                      </span>
                    )}
                  </div>

                  <Link href={`/student/notices/${doc.id}`} className="block focus:outline-none">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-800 group-hover:text-[#176b61] transition-colors leading-snug">
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
                    <span>Published {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end flex-shrink-0 pt-2 sm:pt-0 sm:pl-4">
                  <Link
                    href={`/student/chat?q=${encodeURIComponent(`Explain this archived circular "${doc.title}" and what its historical deadline was.`)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#edf6f3] border border-[#dfe7e3] text-[#176b61] text-xs font-semibold rounded-full shadow-2xs transition-all"
                  >
                    <span>Ask AI</span>
                  </Link>
                  <Link
                    href={`/student/notices/${doc.id}`}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#f5f7f6] hover:bg-[#edf6f3] border border-[#dfe7e3] text-slate-700 hover:text-[#176b61] text-xs font-semibold rounded-full shadow-2xs transition-all"
                  >
                    <span>View notice</span>
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
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-[#dfe7e3] space-y-3">
          <span className="text-3xl">📦</span>
          <h3 className="text-sm font-bold text-slate-900">
            {searchQuery ? 'No matching archived notices found' : 'Archive is empty'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No archived circulars matching "${searchQuery}".`
              : 'Circulars with passed deadlines will automatically appear here for future reference.'}
          </p>
        </div>
      )}
    </div>
  )
}
