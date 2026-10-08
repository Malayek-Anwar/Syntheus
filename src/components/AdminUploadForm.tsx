'use client'

import { useState, useRef } from 'react'
import {
  parsePDF,
  publishDocument,
  discardProcessingDocument,
  type ExtractedData,
  type CandidateEvent,
  type CandidateTimetable,
} from '@/app/admin/actions'
import { useRouter } from 'next/navigation'
import { getErrorMessage } from '@/utils/errors'
import type { DocumentCategory } from '@/types/database'
import { ALL_DOCUMENT_CATEGORIES, CATEGORY_META } from '@/utils/constants'

const ALL_DEPTS = ['CSE', 'ECE', 'ME', 'CE', 'IT']
const ALL_SEMS = [1, 2, 3, 4, 5, 6, 7, 8]

export function AdminUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('notice')
  const [tracksCompletion, setTracksCompletion] = useState<boolean>(false)
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['All'])
  const [selectedSems, setSelectedSems] = useState<number[]>([])
  const [selectedSections, setSelectedSections] = useState<string>('')
  const [candidateEvents, setCandidateEvents] = useState<CandidateEvent[]>([])
  const [candidateTimetable, setCandidateTimetable] = useState<CandidateTimetable | null>(null)
  const [approveCandidateEvents, setApproveCandidateEvents] = useState(false)
  const [approveCandidateTimetable, setApproveCandidateTimetable] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  const handleFileChange = (incomingFile: File | null) => {
    if (!incomingFile) return
    if (incomingFile.type !== 'application/pdf') {
      setError('Please select a valid PDF document.')
      return
    }
    setError(null)
    setFile(incomingFile)
  }

  const handleUpload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!file) return

    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    setLoadingStep('Uploading to private vault & extracting intelligence...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await parsePDF(formData)

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to parse PDF document')
        return
      }

      setExtractedData(result.data)
      setSelectedCategory(result.data.category)
      setTracksCompletion(result.data.tracks_completion)
      setSelectedDepts(
        result.data.target_departments && result.data.target_departments.length > 0
          ? result.data.target_departments
          : ['All']
      )
      setSelectedSems(result.data.target_semesters || [])
      setSelectedSections(result.data.target_sections?.join(', ') || '')
      setCandidateEvents(result.data.candidate_events || [])
      setCandidateTimetable(result.data.candidate_timetable || null)
      setApproveCandidateEvents(false)
      setApproveCandidateTimetable(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
      setLoadingStep('')
    }
  }

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

  const handlePublish = async (e: React.FormEvent<HTMLFormElement>, isDraft: boolean = false) => {
    e.preventDefault()
    if (!extractedData) return

    setIsLoading(true)
    setError(null)

    try {
      const formElement = e.currentTarget.tagName === 'FORM'
        ? (e.currentTarget as HTMLFormElement)
        : ((e.target as HTMLElement).closest('form') as HTMLFormElement)
      const formData = new FormData(formElement)

      const targetDepts = selectedDepts.includes('All') ? null : selectedDepts
      const targetSems = selectedSems.length === 0 ? null : selectedSems
      const targetSecs = selectedSections.trim()
        ? selectedSections.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : null

      const result = await publishDocument({
        documentId: extractedData.documentId,
        title: (formData.get('title') as string) || extractedData.title,
        description: (formData.get('description') as string) || extractedData.description,
        category: selectedCategory,
        tracks_completion: tracksCompletion,
        target_departments: targetDepts,
        target_semesters: targetSems,
        target_sections: targetSecs,
        expires_at: (formData.get('expires_at') as string) || extractedData.expires_at || null,
        candidate_events: approveCandidateEvents ? candidateEvents : [],
        candidate_timetable: approveCandidateTimetable ? candidateTimetable : null,
        isDraft,
      })

      if (!result.success) {
        setError(result.error || 'Failed to save document')
        return
      }

      setSuccessMessage(
        isDraft
          ? 'Document saved as draft (hidden from students).'
          : 'Reviewed document published with approved structured data.'
      )
      setExtractedData(null)
      setFile(null)
      router.refresh()

      setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // VIEW 1: REVIEW & FINALIZE FORM
  if (extractedData) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 sm:p-6 w-full space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#edf6f3] text-[#176b61] border border-[#cce5df] flex items-center justify-center font-bold text-xs">
              AI
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Review & Finalize Institutional Document</h3>
              <p className="text-[11px] text-gray-500">
                AI extracted metadata, targeting, and candidate events. Review and confirm before publishing.
              </p>
            </div>
          </div>

          {extractedData.signedUrl && (
            <a
              href={extractedData.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#176b61] hover:text-[#12564f] font-semibold inline-flex items-center gap-1"
            >
              Preview PDF ↗
            </a>
          )}
        </div>

        <form onSubmit={handlePublish} className="space-y-4">
          {/* Row 1: Title and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Document Title *</label>
              <input
                type="text"
                name="title"
                defaultValue={extractedData.title}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none bg-white"
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

          {/* Row 2: Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description / Summary
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={extractedData.description}
              className="w-full rounded-lg border border-[#cce5df] bg-[#f4faf8] px-3 py-2 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none leading-relaxed"
              placeholder="Concise overview for students..."
            />
          </div>

          {/* Row 3: Audience Filtering */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2.5">
            <span className="text-xs font-semibold text-gray-800 block">
              🎯 Academic Profile Targeting (NULL = Universal / All)
            </span>

            {/* Departments */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">Departments:</span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleDept('All')}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
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
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
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

            {/* Semesters */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-gray-600">Semesters (Empty = All Semesters):</span>
              <div className="flex flex-wrap items-center gap-1">
                {ALL_SEMS.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => toggleSem(sem)}
                    className={`w-8 h-7 text-xs font-semibold rounded-md border transition-colors cursor-pointer flex items-center justify-center ${
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

            {/* Section distinction */}
            <div className="pt-1">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Target Sections (Comma-separated e.g. A, B — empty means all sections):
              </label>
              <input
                type="text"
                value={selectedSections}
                onChange={(e) => setSelectedSections(e.target.value)}
                placeholder="All sections"
                className="w-full sm:w-60 rounded-md border border-gray-300 px-2.5 py-1 text-xs uppercase"
              />
            </div>
          </div>

          {/* Row 4: Completion Tracking & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tracks_completion"
                checked={tracksCompletion}
                onChange={(e) => setTracksCompletion(e.target.checked)}
                className="w-4 h-4 text-[#176b61] rounded border-gray-300 focus:ring-[#176b61]"
              />
              <label htmlFor="tracks_completion" className="text-xs font-semibold text-gray-800 cursor-pointer">
                Track Student Completion
              </label>
              <span className="text-[10px] text-gray-400">(Students can mark as done)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Expiration / Cutoff Date
              </label>
              <input
                type="date"
                name="expires_at"
                defaultValue={extractedData.expires_at ? extractedData.expires_at.split('T')[0] : ''}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-900"
              />
            </div>
          </div>

          {/* Row 5: Candidate Academic Events Preview */}
          {candidateEvents.length > 0 && (
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">
                  📅 Extracted Academic Events ({candidateEvents.length})
                </span>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={approveCandidateEvents}
                    onChange={(e) => setApproveCandidateEvents(e.target.checked)}
                  />
                  Approve and add to Calendar
                </label>
              </div>
              <div className="space-y-1.5">
                {candidateEvents.map((ev, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-white border border-gray-200 text-xs">
                    <div>
                      <span className="font-semibold text-gray-900">{ev.title}</span>
                      <span className="ml-2 text-[10px] uppercase font-bold text-[#176b61] px-1.5 py-0.5 rounded bg-[#edf6f3]">
                        {ev.event_type}
                      </span>
                    </div>
                    <span className="text-gray-500 font-mono text-[11px]">{ev.starts_at.split('T')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {candidateTimetable && (
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/60 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    Suggested Timetable: {candidateTimetable.name} ({candidateTimetable.entries.length} entries)
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {candidateTimetable.valid_from}
                    {candidateTimetable.valid_until ? ` to ${candidateTimetable.valid_until}` : ''}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={approveCandidateTimetable}
                    onChange={(e) => setApproveCandidateTimetable(e.target.checked)}
                  />
                  Approve and add
                </label>
              </div>
              <div className="max-h-32 overflow-auto rounded border border-gray-200 bg-white">
                {candidateTimetable.entries.map((entry, index) => (
                  <p key={`${entry.day_of_week}-${entry.start_time}-${index}`} className="px-2 py-1 text-[10px] text-gray-600 border-b last:border-b-0">
                    Day {entry.day_of_week}, {entry.start_time}–{entry.end_time}: {entry.subject}
                    {entry.room ? ` · ${entry.room}` : ''}
                    {entry.instructor ? ` · ${entry.instructor}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-xs font-medium">{error}</p>}

          {/* Action buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                setIsLoading(true)
                setError(null)
                try {
                  const result = await discardProcessingDocument(extractedData.documentId)
                  if (!result.success) {
                    setError(result.error || 'Failed to discard processing document')
                    return
                  }
                  setExtractedData(null)
                  setFile(null)
                  setCandidateEvents([])
                  setCandidateTimetable(null)
                  setApproveCandidateEvents(false)
                  setApproveCandidateTimetable(false)
                } catch (err) {
                  setError(getErrorMessage(err))
                } finally {
                  setIsLoading(false)
                }
              }}
              className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-3 py-1.5 cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={(e) => {
                  const form = e.currentTarget.closest('form') as HTMLFormElement
                  if (form) {
                    const fakeEvent = {
                      preventDefault: () => {},
                      currentTarget: form,
                      target: form,
                    } as unknown as React.FormEvent<HTMLFormElement>
                    handlePublish(fakeEvent, true)
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#176b61] hover:bg-[#12564f] rounded-full shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                {isLoading ? 'Publishing...' : 'Publish to Students →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  // VIEW 2: DRAG & DROP UPLOAD
  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 sm:p-6 w-full space-y-4">
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center space-y-3 animate-in fade-in duration-200">
          <span className="inline-block w-8 h-8 border-2 border-[#176b61] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#176b61] font-medium">{loadingStep}</p>
        </div>
      ) : (
        <form onSubmit={handleUpload} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              if (e.dataTransfer.files?.[0]) {
                handleFileChange(e.dataTransfer.files[0])
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-[#72b5aa] bg-[#edf6f3]'
                : file
                ? 'border-[#a9d2c9] bg-[#f4faf8]'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-lg bg-[#edf6f3] text-[#176b61] border border-[#cce5df] flex items-center justify-center text-lg">
                📄
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-gray-900">
                  {file ? file.name : 'Select or drag & drop institutional PDF document'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {file
                    ? `${Math.round(file.size / 1024)} KB • Ready for extraction`
                    : 'PDFs up to 25MB (Notices, circulars, syllabi, fee circulars, notes, timetables)'}
                </p>
              </div>
            </div>
          </div>

          {error && <p className="text-red-600 text-xs font-medium text-center">{error}</p>}

          <div className="flex items-center justify-between">
            {file ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-gray-500 hover:text-red-600 cursor-pointer"
              >
                Clear file
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={!file || isLoading}
              className="px-5 py-2 rounded-full font-semibold text-xs text-white bg-[#176b61] hover:bg-[#12564f] disabled:opacity-50 cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>⚡ Analyze & Extract</span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
