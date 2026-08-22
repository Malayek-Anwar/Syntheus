'use client'

import { useState, useMemo } from 'react'
import { EditAdminDocumentModal, type AdminDocumentItem } from './EditAdminDocumentModal'
import { DeleteAdminDocumentButton } from './DeleteAdminDocumentButton'
import { toggleDocumentLifecycle } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'

const DOC_TYPE_META: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  fee_notice: { label: 'Fee & Dues', icon: '💳', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  academic_calendar: { label: 'Academic Calendar', icon: '📅', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  holiday_notice: { label: 'Holiday Notice', icon: '🎉', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  academic_notes: { label: 'Class Notes', icon: '📚', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  exam_circular: { label: 'Exam Circular', icon: '📝', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  general_notice: { label: 'General Notice', icon: '📢', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
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
    const res = await toggleDocumentLifecycle(id, action)
    setIsTogglingId(null)
    if (res.success) {
      router.refresh()
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
      </div>

      {/* Lifecycle Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'live'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 bg-white border border-gray-200/80'
          }`}
        >
          <span>🟢</span>
          <span>Live ({counts.live})</span>
        </button>

        <button
          onClick={() => setActiveTab('drafts')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'drafts'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 bg-white border border-gray-200/80'
          }`}
        >
          <span>🟡</span>
          <span>Drafts ({counts.drafts})</span>
        </button>

        <button
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'archived'
              ? 'bg-gray-800 text-white shadow-2xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 bg-white border border-gray-200/80'
          }`}
        >
          <span>📦</span>
          <span>Archived ({counts.archived})</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 bg-white border border-gray-200/80'
          }`}
        >
          <span>📄</span>
          <span>All Documents ({counts.all})</span>
        </button>
      </div>

      {/* Document List */}
      {filteredDocuments.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
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
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-snug">{doc.title}</h3>
                      
                      {/* Lifecycle Status Badge */}
                      {isLive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                          LIVE
                        </span>
                      )}
                      {isDraft && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                          DRAFT
                        </span>
                      )}
                      {isArchived && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-300">
                          ARCHIVED
                        </span>
                      )}

                      {doc.priority?.toLowerCase() === 'high' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200">
                          HIGH
                        </span>
                      )}
                    </div>

                    {doc.summary && (
                      <p className="text-xs text-gray-600 line-clamp-1 italic">{doc.summary}</p>
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
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 underline pt-1"
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
