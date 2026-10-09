'use client'

import { useState, useMemo } from 'react'
import { EditAdminDocumentModal, type AdminDocumentItem } from './EditAdminDocumentModal'
import { DeleteAdminDocumentButton } from './DeleteAdminDocumentButton'
import { toggleDocumentLifecycle } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'
import { CATEGORY_META } from '@/utils/constants'
import { formatInstitutionalDate } from '@/utils/deadlines'

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

  const counts = useMemo(() => {
    let live = 0
    let drafts = 0
    let archived = 0

    documents.forEach((doc) => {
      if (doc.status === 'archived') {
        archived++
      } else if (doc.status === 'draft') {
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

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const isArchived = doc.status === 'archived'
      const isDraft = doc.status === 'draft'
      const isLive = doc.status === 'published'

      if (activeTab === 'live' && !isLive) return false
      if (activeTab === 'drafts' && !isDraft) return false
      if (activeTab === 'archived' && !isArchived) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = doc.title.toLowerCase().includes(q)
        const matchDesc = (doc.description || '').toLowerCase().includes(q)
        const matchCat = (doc.category || '').toLowerCase().includes(q)
        const matchDepts = (doc.target_departments || []).some(d => d.toLowerCase().includes(q))
        return matchTitle || matchDesc || matchCat || matchDepts
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
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Institutional Document Directory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage lifecycle, categories, targeting, and completion settings.</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
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

      {/* Tabs */}
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
            const catMeta = CATEGORY_META[doc.category] || { label: doc.category, icon: '📄' }
            const depts = doc.target_departments && doc.target_departments.length > 0
              ? doc.target_departments.join(', ')
              : 'Universal (All)'

            const isArchived = doc.status === 'archived'
            const isDraft = doc.status === 'draft'
            const isLive = doc.status === 'published'

            return (
              <div
                key={doc.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfcfb] transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#176b61] flex items-center gap-1">
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.label}</span>
                    </span>

                    {/* Status Badge */}
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

                    {doc.tracks_completion && (
                      <span className="text-[10px] font-semibold text-[#35635d] bg-[#eef4f3] px-2 py-0.5 rounded-full border border-[#d5e5e1]">
                        ✓ Tracks Completion
                      </span>
                    )}

                    {doc.expires_at && (
                      <span className="text-[11px] font-medium text-[#756843] bg-[#f5f3eb] px-2 py-0.5 rounded-full border border-[#e7dfc5]">
                        Expires {formatInstitutionalDate(doc.expires_at)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">{doc.title}</h3>

                  {doc.description && (
                    <p className="text-xs text-slate-500 line-clamp-1">{doc.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 pt-0.5">
                    <span className="text-slate-600 font-medium">Depts: {depts}</span>
                    {doc.target_semesters && doc.target_semesters.length > 0 && (
                      <span>· Sem: {doc.target_semesters.join(', ')}</span>
                    )}
                    {doc.target_sections && doc.target_sections.length > 0 && (
                      <span>· Sec: {doc.target_sections.join(', ')}</span>
                    )}
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  {isDraft && (
                    <button
                      onClick={() => setEditingDoc(doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>Edit</span>
                    </button>
                  )}

                  {isDraft && (
                    <button
                      onClick={() => handleQuickToggle(doc.id, 'publish')}
                      disabled={isTogglingId === doc.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Publish live to students"
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
                      title="Archive document"
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
                      title="Restore back to live"
                    >
                      <span>♻️</span>
                      <span>{isTogglingId === doc.id ? 'Restoring...' : 'Restore'}</span>
                    </button>
                  )}

                  <DeleteAdminDocumentButton id={doc.id} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed space-y-3">
          <span className="text-3xl">📄</span>
          <h3 className="text-sm font-bold text-gray-900">
            {searchQuery ? 'No matching documents found' : `No ${activeTab !== 'all' ? activeTab : ''} documents found`}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery
              ? `No circulars matching "${searchQuery}" in this tab.`
              : 'Upload institutional documents in the studio above to get started.'}
          </p>
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
