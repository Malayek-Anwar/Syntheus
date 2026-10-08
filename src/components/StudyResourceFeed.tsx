'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { CATEGORY_META } from '@/utils/constants'
import type { StudyCategory } from '@/types/database'

export interface StudyItem {
  id: string
  title: string
  category: StudyCategory
  description?: string | null
  target_departments?: string[] | null
  target_semesters?: number[] | null
  target_sections?: string[] | null
  created_at: string
}

interface StudyResourceFeedProps {
  documents: StudyItem[]
}

type StudyFilterTab = 'all' | StudyCategory

const STUDY_TABS: Array<{ key: StudyFilterTab; label: string; icon: string }> = [
  { key: 'all', label: 'All Resources', icon: '📂' },
  { key: 'notes', label: 'Lecture Notes', icon: '📓' },
  { key: 'reference_material', label: 'Reference Books', icon: '📚' },
  { key: 'question_paper', label: 'Past Papers', icon: '📄' },
  { key: 'question_bank', label: 'Question Banks', icon: '🗂️' },
  { key: 'assignment', label: 'Assignments', icon: '📋' },
]

export function StudyResourceFeed({ documents = [] }: StudyResourceFeedProps) {
  const [activeTab, setActiveTab] = useState<StudyFilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<StudyFilterTab, number> = {
      all: documents.length,
      notes: 0,
      reference_material: 0,
      question_paper: 0,
      question_bank: 0,
      assignment: 0,
    }
    documents.forEach((doc) => {
      if (c[doc.category] !== undefined) {
        c[doc.category]++
      }
    })
    return c
  }, [documents])

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (activeTab !== 'all' && doc.category !== activeTab) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = doc.title.toLowerCase().includes(q)
        const matchDesc = (doc.description || '').toLowerCase().includes(q)
        const matchDept = (doc.target_departments || []).some((d) => d.toLowerCase().includes(q))
        return matchTitle || matchDesc || matchDept
      }

      return true
    })
  }, [documents, activeTab, searchQuery])

  return (
    <div className="space-y-5">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, textbooks, past papers..."
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-xl bg-white border border-gray-300 shadow-2xs focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] transition-all placeholder:text-gray-400"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-3 text-xs text-gray-400 hover:text-gray-600 p-0.5"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[#dfe7e3]">
        {STUDY_TABS.map((tab) => {
          const isActive = activeTab === tab.key
          const count = counts[tab.key] || 0

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
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Document Grid */}
      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => {
            const meta = CATEGORY_META[doc.category] || { label: doc.category, icon: '📄' }
            const depts =
              doc.target_departments && doc.target_departments.length > 0
                ? doc.target_departments.join(', ')
                : 'All Depts'

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-xs hover:border-[#176b61]/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#edf6f3] text-[#176b61] border border-[#cce5df]">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {new Date(doc.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <Link href={`/student/notices/${doc.id}`} className="block">
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-[#176b61] transition-colors line-clamp-2 leading-snug">
                      {doc.title}
                    </h3>
                  </Link>

                  {doc.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {doc.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 text-gray-500 text-[11px]">
                    <span className="font-semibold text-gray-700">{depts}</span>
                    {doc.target_semesters && doc.target_semesters.length > 0 && (
                      <span>• Sem {doc.target_semesters.join(', ')}</span>
                    )}
                    {doc.target_sections && doc.target_sections.length > 0 && (
                      <span>• Sec {doc.target_sections.join(', ')}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/student/notices/${doc.id}`}
                      className="px-3 py-1.5 bg-[#176b61] hover:bg-[#12564f] text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-14 bg-white rounded-2xl border border-gray-200 border-dashed space-y-3">
          <span className="text-4xl">📚</span>
          <h3 className="text-base font-bold text-gray-900">No study resources found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery
              ? `No study materials match "${searchQuery}". Try a different keyword.`
              : 'There are currently no uploaded study resources for this filter.'}
          </p>
          {(activeTab !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setActiveTab('all')
                setSearchQuery('')
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#176b61] hover:text-[#12564f] underline pt-1 cursor-pointer"
            >
              Reset filters & show all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
