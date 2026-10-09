'use client'

import { useState, useEffect } from 'react'
import { updateDocument } from '@/app/admin/actions'
import { getErrorMessage } from '@/utils/errors'
import { useRouter } from 'next/navigation'
import type { DocumentCategory } from '@/types/database'
import { ALL_DOCUMENT_CATEGORIES, CATEGORY_META } from '@/utils/constants'

const ALL_DEPTS = ['CSE', 'ECE', 'ME', 'CE', 'IT']
const ALL_SEMS = [1, 2, 3, 4, 5, 6, 7, 8]

export interface AdminDocumentItem {
  id: string
  title: string
  description?: string | null
  category: DocumentCategory
  status: 'published' | 'draft' | 'archived' | 'processing'
  tracks_completion: boolean
  target_departments?: string[] | null
  target_semesters?: number[] | null
  target_sections?: string[] | null
  expires_at?: string | null
  created_at: string
}

interface EditAdminDocumentModalProps {
  document: AdminDocumentItem | null
  isOpen: boolean
  onClose: () => void
}

export function EditAdminDocumentModal({
  document,
  isOpen,
  onClose,
}: EditAdminDocumentModalProps) {
  const router = useRouter()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = window.getComputedStyle(window.document.body).overflow
    window.document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !document) return null

  return <EditAdminDocumentModalForm document={document} onClose={onClose} router={router} />
}

function EditAdminDocumentModalForm({
  document,
  onClose,
  router,
}: {
  document: AdminDocumentItem
  onClose: () => void
  router: ReturnType<typeof useRouter>
}) {
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(document.category || 'notice')
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    document.target_departments && document.target_departments.length > 0 ? document.target_departments : ['All']
  )
  const [selectedSems, setSelectedSems] = useState<number[]>(document.target_semesters || [])
  const [selectedSections, setSelectedSections] = useState<string>(document.target_sections?.join(', ') || '')
  const [tracksCompletion, setTracksCompletion] = useState<boolean>(document.tracks_completion || false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleDept = (dept: string) => {
    if (dept === 'All') {
      setSelectedDepts(['All'])
      return
    }
    const filtered = selectedDepts.filter(d => d !== 'All')
    if (filtered.includes(dept)) {
      const next = filtered.filter(d => d !== dept)
      setSelectedDepts(next.length === 0 ? ['All'] : next)
    } else {
      setSelectedDepts([...filtered, dept])
    }
  }

  const toggleSem = (sem: number) => {
    if (selectedSems.includes(sem)) {
      setSelectedSems(selectedSems.filter(s => s !== sem))
    } else {
      setSelectedSems([...selectedSems, sem].sort((a, b) => a - b))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const targetDepts = selectedDepts.includes('All') ? null : selectedDepts
      const targetSems = selectedSems.length === 0 ? null : selectedSems
      const targetSecs = selectedSections.trim()
        ? selectedSections.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : null

      const result = await updateDocument({
        id: document.id,
        title: ((formData.get('title') as string) || '').trim(),
        description: ((formData.get('description') as string) || '').trim() || null,
        category: selectedCategory,
        tracks_completion: tracksCompletion,
        target_departments: targetDepts,
        target_semesters: targetSems,
        target_sections: targetSecs,
        expires_at: (formData.get('expires_at') as string) || null,
      })

      if (!result.success) {
        setError(result.error || 'Failed to update document')
        return
      }

      onClose()
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>✏️</span> Edit Institutional Document Metadata
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Update targeting, categories, and completion tracking. Manage lifecycle from the document directory.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 transition-colors cursor-pointer"
            aria-label="Close edit modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Title and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                name="title"
                defaultValue={document.title}
                required
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-[#176b61] outline-none"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-[#176b61] outline-none bg-white"
              >
                <optgroup label="Institute">
                  {ALL_DOCUMENT_CATEGORIES.filter(c => CATEGORY_META[c].group === 'institute').map(c => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Study Resources">
                  {ALL_DOCUMENT_CATEGORIES.filter(c => CATEGORY_META[c].group === 'study').map(c => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={document.description || ''}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] outline-none"
            />
          </div>

          {/* Completion Tracking & Expiration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_tracks_completion"
                checked={tracksCompletion}
                onChange={(e) => setTracksCompletion(e.target.checked)}
                className="w-4 h-4 text-[#176b61] rounded border-gray-300 focus:ring-[#176b61]"
              />
              <label htmlFor="edit_tracks_completion" className="text-xs font-semibold text-gray-800 cursor-pointer">
                Track Student Completion
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Expiration / Cutoff Date
              </label>
              <input
                type="date"
                name="expires_at"
                defaultValue={document.expires_at ? document.expires_at.split('T')[0] : ''}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-900"
              />
            </div>
          </div>

          {/* Audience Targeting */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider">
              🎯 Academic Profile Targeting
            </label>
            <div>
              <span className="text-xs font-semibold text-gray-600 block mb-1.5">Departments:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleDept('All')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    selectedDepts.includes('All')
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                {ALL_DEPTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      selectedDepts.includes(dept) && !selectedDepts.includes('All')
                        ? 'bg-[#176b61] text-white border-[#176b61]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-gray-600 block mb-1.5">Semesters:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {ALL_SEMS.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => toggleSem(sem)}
                    className={`w-9 h-8 text-xs font-semibold rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                      selectedSems.includes(sem)
                        ? 'bg-[#176b61] text-white border-[#176b61]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    S{sem}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Target Sections (Comma-separated uppercase e.g. A, B — empty means all):
              </label>
              <input
                type="text"
                value={selectedSections}
                onChange={(e) => setSelectedSections(e.target.value)}
                className="w-full sm:w-60 rounded-md border border-gray-300 px-2.5 py-1 text-xs uppercase"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 text-xs font-bold text-white bg-[#176b61] hover:bg-[#12564f] rounded-full shadow-md disabled:opacity-50 cursor-pointer transition-all"
            >
              {isSaving ? 'Saving Changes...' : 'Save & Update Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
