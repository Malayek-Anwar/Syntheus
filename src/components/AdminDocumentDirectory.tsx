'use client'

import { useState, useMemo } from 'react'
import { EditAdminDocumentModal, type AdminDocumentItem } from './EditAdminDocumentModal'
import { DeleteAdminDocumentButton } from './DeleteAdminDocumentButton'
import { toggleDocumentLifecycle } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'

const DOC_TYPE_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  fee_notice: { label: 'Fee & Dues', icon: '💳', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  academic_calendar: { label: 'Academic Calendar', icon: '📅', bg: 'bg-[#eef4f3]', text: 'text-[#35635d]', border: 'border-[#d5e5e1]' },
  holiday_notice: { label: 'Holiday Notice', icon: '🎉', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  academic_notes: { label: 'Class Notes', icon: '📚', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  exam_circular: { label: 'Exam Circular', icon: '📝', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  general_notice: { label: 'General Notice', icon: '📢', bg: 'bg-[#eef4f3]', text: 'text-[#35635d]', border: 'border-[#d5e5e1]' },
}

type LifecycleTab = 'live' | 'drafts' | 'archived' | 'all'

interface AdminDocumentDirectoryProps {
  documents: AdminDocumentItem[]
}

export function AdminDocumentDirectory({ documents = [] }: AdminDocumentDirectoryProps) {
  const [activeTab, setActiveTab] = useState<LifecycleTab>('live')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingDoc, setEditingDoc] = useState<AdminDocumentItem | null>(null)
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null)
  const router = useRouter()

  // Calculate counts for each lifecycle state
  const counts = useMemo(() => {
    let live = 0
    let drafts = 0
    let archived = 0

    documents.forEach((doc) => {
      if (doc.is_archived) {
        archived++
      } else if (doc.is_published === false) {
        drafts++
      } else {
        live++
      }
    })

    return {
      live,
      drafts,
      archived,
      all: documents.length,
    }
  }, [documents])

  // Filter documents by active tab and search query
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // 1. Tab matching
      const isArchived = Boolean(doc.is_archived)
      const isDraft = doc.is_published === false && !isArchived
      const isLive = doc.is_published !== false && !isArchived

      if (activeTab === 'live' && !isLive) return false
      if (activeTab === 'drafts' && !isDraft) return false
      if (activeTab === 'archived' && !isArchived) return false

      // 2. Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = doc.title.toLowerCase().includes(q)
        const matchSummary = (doc.summary || '').toLowerCase().includes(q)
        const matchCategory = (doc.category || '').toLowerCase().includes(q)
        const matchType = (doc.doc_type || '').toLowerCase().includes(q)
        const matchDepts = (doc.target_departments || []).some(d => d.toLowerCase().includes(q))
        return matchTitle || matchSummary || matchCategory || matchType || matchDepts
      }

      return true
    })
  }, [documents, activeTab, searchQuery])

  const handleQuickToggle = async (id: string, action: 'publish' | 'draft' | 'archive' | 'restore') => {
    setIsTogglingId(id)
    try {
      const res = await toggleDocumentLifecycle(id, action)
      if (res.success) {
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to toggle document lifecycle:', err)
    } finally {
      setIsTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header, Search & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Published Campus Documents</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage publication states, edit metadata, and monitor indexed circulars.</p>
        </div>

        {/* Live Search Bar */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circulars..."
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
      </div>

      {/* Lifecycle Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#dfe7e3]">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'live'
              ? 'bg-[#176b61] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#edf6f3] bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>Live</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'live' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.live}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'drafts'
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-amber-50/50 bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>Drafts</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'drafts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.drafts}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'archived'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>Archived</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'archived' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.archived}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>All Documents</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.all}
          </span>
        </button>
      </div>

      {/* Document List */}
      {filteredDocuments.length > 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-[#dfe7e3] overflow-hidden divide-y divide-[#dfe7e3]">
          {filteredDocuments.map((doc) => {
            const docTypeKey = doc.doc_type || 'general_notice'
            const typeMeta = DOC_TYPE_META[docTypeKey] || DOC_TYPE_META.general_notice
            const depts = doc.target_departments && doc.target_departments.length > 0 && !doc.target_departments.includes('All')
              ? doc.target_departments.join(', ')
              : 'Campus Wide'

            const isArchived = Boolean(doc.is_archived)
            const isDraft = doc.is_published === false && !isArchived
            const isLive = doc.is_published !== false && !isArchived

            return (
              <div
                key={doc.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfcfb] transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#176b61]">
                      {typeMeta.label}
                    </span>
                    
                    {/* Lifecycle Status Badge */}
                    {isLive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                        LIVE
                      </span>
                    )}
                    {isDraft && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                        DRAFT
                      </span>
                    )}
                    {isArchived && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-300">
                        ARCHIVED
                      </span>
                    )}

                    {doc.priority?.toLowerCase() === 'high' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-200">
                        URGENT
                      </span>
                    )}

                    {doc.deadline && (
                      <span className="text-[11px] font-medium text-[#756843] bg-[#f5f3eb] px-2 py-0.5 rounded-full border border-[#e7dfc5]">
                        Due {new Date(doc.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">{doc.title}</h3>

                  {doc.summary && (
                    <p className="text-xs text-slate-500 line-clamp-1">{doc.summary}</p>
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

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  {/* Edit Button */}
                  <button
                    onClick={() => setEditingDoc(doc)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>Edit</span>
                  </button>

                  {/* 1-Click Quick Lifecycle Transition Button */}
                  {isDraft && (
                    <button
                      onClick={() => handleQuickToggle(doc.id, 'publish')}
                      disabled={isTogglingId === doc.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Publish this draft live to students"
                    >
                      <span>🚀</span>
                      <span>{isTogglingId === doc.id ? 'Publishing...' : 'Publish'}</span>
                    </button>
                  )}

                  {isLive && (
                    <button
                      onClick={() => handleQuickToggle(doc.id, 'archive')}
                      disabled={isTogglingId === doc.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Archive and hide from active student feed"
                    >
                      <span>📦</span>
                      <span>{isTogglingId === doc.id ? 'Archiving...' : 'Archive'}</span>
                    </button>
                  )}

                  {isArchived && (
                    <button
                      onClick={() => handleQuickToggle(doc.id, 'restore')}
                      disabled={isTogglingId === doc.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#edf6f3] hover:bg-[#dceee9] border border-[#cce5df] text-[#176b61] text-xs font-semibold rounded-full shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Restore back to live feed"
                    >
                      <span>♻️</span>
                      <span>{isTogglingId === doc.id ? 'Restoring...' : 'Restore'}</span>
                    </button>
                  )}

                  {/* View PDF */}
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                  >
                    <span>View PDF</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* Delete Button */}
                  <DeleteAdminDocumentButton id={doc.id} fileUrl={doc.file_url} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed space-y-3">
          <span className="text-3xl">📄</span>
          <h3 className="text-sm font-bold text-gray-900">
            {searchQuery ? 'No matching documents found' : `No ${activeTab !== 'all' ? activeTab : ''} circulars found`}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery 
              ? `No circulars matching "${searchQuery}" in this tab.`
              : 'Upload a PDF circular in the studio above to get started.'}
          </p>
          {(activeTab !== 'live' || searchQuery) && (
            <button
              onClick={() => {
                setActiveTab('live')
                setSearchQuery('')
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#176b61] hover:text-[#12564f] underline pt-1"
            >
              Reset filters & show live circulars
            </button>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <EditAdminDocumentModal
        document={editingDoc}
        isOpen={Boolean(editingDoc)}
        onClose={() => setEditingDoc(null)}
      />
    </div>
  )
}
