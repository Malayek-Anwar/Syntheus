'use client'

import { useState, useRef } from 'react'
import { parsePDF, publishDocument, type ExtractedData, type DocType, type TimelineMilestone } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'
import { getErrorMessage } from '@/utils/errors'

const DOC_TYPE_OPTIONS: { type: DocType; label: string; icon: string }[] = [
  { type: 'fee_notice', label: 'Fee & Dues', icon: '💳' },
  { type: 'academic_calendar', label: 'Academic Calendar', icon: '📅' },
  { type: 'holiday_notice', label: 'Holiday Notice', icon: '🎉' },
  { type: 'academic_notes', label: 'Class Notes / Syllabus', icon: '📚' },
  { type: 'exam_circular', label: 'Exam Circular', icon: '📝' },
  { type: 'general_notice', label: 'General Notice', icon: '📢' },
]

const ALL_DEPTS = ['CSE', 'ECE', 'ME', 'CE', 'IT']
const ALL_SEMS = [1, 2, 3, 4, 5, 6, 7, 8]

export function AdminUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [selectedDocType, setSelectedDocType] = useState<DocType>('general_notice')
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['All'])
  const [selectedSems, setSelectedSems] = useState<number[]>([])
  const [timelineItems, setTimelineItems] = useState<TimelineMilestone[]>([])
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
    setLoadingStep('Uploading & running AI extraction...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await parsePDF(formData)
      
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to parse PDF document')
        return
      }

      setExtractedData(result.data)
      setSelectedDocType(result.data.doc_type)
      setSelectedDepts(result.data.target_departments.length > 0 ? result.data.target_departments : ['All'])
      setSelectedSems(result.data.target_semesters)
      setTimelineItems(result.data.timeline || [])
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
      const formElement = e.currentTarget.tagName === 'FORM' ? e.currentTarget as HTMLFormElement : (e.target as HTMLElement).closest('form') as HTMLFormElement
      const formData = new FormData(formElement)

      const keyPointsRaw = formData.get('key_points') as string
      const key_points = keyPointsRaw
        ? keyPointsRaw.split('\n').map(line => line.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
        : extractedData.key_points

      const actionItemsRaw = formData.get('action_items') as string
      const action_items = actionItemsRaw
        ? actionItemsRaw.split('\n').map(line => line.replace(/^(\d+\.|\-|\*|\[\s*\])\s*/, '').trim()).filter(Boolean)
        : extractedData.action_items

      const finalData: ExtractedData = {
        ...extractedData,
        title: (formData.get('title') as string) || extractedData.title,
        doc_type: selectedDocType,
        category: (formData.get('category') as string) || extractedData.category,
        audience: selectedDepts.join(', '),
        target_departments: selectedDepts,
        target_semesters: selectedSems,
        summary: (formData.get('summary') as string) || extractedData.summary,
        key_points,
        action_items,
        timeline: timelineItems,
        dates: (formData.get('dates') as string) || extractedData.dates,
        starts_at: (formData.get('starts_at') as string) || extractedData.starts_at || null,
        deadline: (formData.get('deadline') as string) || extractedData.deadline || null,
        priority: (formData.get('priority') as string) || extractedData.priority,
        subject_code: (formData.get('subject_code') as string) || extractedData.subject_code || null,
      }

      const result = await publishDocument(finalData, isDraft)
      
      if (!result.success) {
        setError(result.error || 'Failed to save document')
        return
      }

      setSuccessMessage(
        isDraft 
          ? 'Document saved as draft (hidden from students)!' 
          : 'Document published, summarized, and vectorized successfully!'
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

  // =========================================================================
  // VIEW 1: MINIMAL REVIEW & PUBLISH CARD
  // =========================================================================
  if (extractedData) {
    return (
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 sm:p-6 w-full space-y-5 animate-in fade-in duration-200">
        {/* Minimal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#edf6f3] text-[#176b61] border border-[#cce5df] flex items-center justify-center font-bold text-xs">
              AI
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Review Extracted Information</h3>
              <p className="text-[11px] text-gray-500">Verify extracted details before publishing to students.</p>
            </div>
          </div>

          {extractedData.fileUrl && (
            <a
              href={extractedData.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#176b61] hover:text-[#12564f] font-semibold inline-flex items-center gap-1"
            >
              View PDF ↗
            </a>
          )}
        </div>

        {/* Minimal Review Form */}
        <form onSubmit={handlePublish} className="space-y-4">
          {/* Row 1: Title, Category & Archetype */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notice Title</label>
              <input
                type="text"
                name="title"
                defaultValue={extractedData.title}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Circular Archetype</label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value as DocType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none bg-white"
              >
                {DOC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category Label</label>
              <input
                type="text"
                name="category"
                defaultValue={extractedData.category}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
              />
            </div>
          </div>

          {/* Row 2: AI Executive Summary */}
          <div>
            <label className="block text-xs font-semibold text-[#244b46] mb-1">
              ✨ AI Executive Summary
            </label>
            <textarea
              name="summary"
              rows={2}
              defaultValue={extractedData.summary}
              className="w-full rounded-lg border border-[#cce5df] bg-[#f4faf8] px-3 py-2 text-xs sm:text-sm text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none leading-relaxed"
              placeholder="Concise summary for student overview..."
            />
          </div>

          {/* Row 3: Key Points & Action Items side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                📌 Key Rules & Stipulations (One per line)
              </label>
              <textarea
                name="key_points"
                rows={3}
                defaultValue={extractedData.key_points.map(p => `• ${p}`).join('\n')}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ✅ Action Checklist (One per line)
              </label>
              <textarea
                name="action_items"
                rows={3}
                defaultValue={extractedData.action_items.map((a, i) => `${i + 1}. ${a}`).join('\n')}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Row 4: Timeline Milestones (Compact) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800">
                ⏳ Multi-Stage Timeline / Milestones
              </span>
              <button
                type="button"
                onClick={() => {
                  setTimelineItems([
                    ...timelineItems,
                    { label: 'Stage', date: new Date().toISOString().split('T')[0], fee_penalty: null, description: null }
                  ])
                }}
                className="text-[11px] font-semibold text-[#176b61] hover:text-[#12564f] cursor-pointer"
              >
                + Add Stage
              </button>
            </div>

            {timelineItems.length > 0 ? (
              <div className="space-y-1.5">
                {timelineItems.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) => {
                        const next = [...timelineItems]
                        next[idx].label = e.target.value
                        setTimelineItems(next)
                      }}
                      placeholder="Stage (e.g. Without Fine)"
                      className="flex-1 px-2.5 py-1 rounded border border-gray-300 bg-white text-xs font-medium"
                    />
                    <input
                      type="text"
                      value={m.fee_penalty || ''}
                      onChange={(e) => {
                        const next = [...timelineItems]
                        next[idx].fee_penalty = e.target.value || null
                        setTimelineItems(next)
                      }}
                      placeholder="Penalty (optional)"
                      className="w-28 px-2.5 py-1 rounded border border-gray-300 bg-white text-xs text-orange-700"
                    />
                    <input
                      type="date"
                      value={m.date}
                      onChange={(e) => {
                        const next = [...timelineItems]
                        next[idx].date = e.target.value
                        setTimelineItems(next)
                      }}
                      className="px-2 py-1 rounded border border-gray-300 bg-white text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setTimelineItems(timelineItems.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 px-1 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">No multi-stage dates specified.</p>
            )}
          </div>

          {/* Row 5: Audience (Departments & Semesters) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2.5">
            <span className="text-xs font-semibold text-gray-800 block">
              🎯 Target Audience Filtering
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
          </div>

          {/* Row 6: Procedure dates & priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Procedure Opens</label>
              <input
                type="date"
                name="starts_at"
                defaultValue={extractedData.starts_at || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Deadline</label>
              <input
                type="date"
                name="deadline"
                defaultValue={extractedData.deadline || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
              <select
                name="priority"
                defaultValue={extractedData.priority}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] outline-none bg-white"
              >
                <option value="High">🔴 High Priority</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">⚪ Low</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-600 text-xs font-medium">{error}</p>}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setExtractedData(null)
                setFile(null)
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
                  const form = (e.currentTarget.closest('form')) as HTMLFormElement
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

  // =========================================================================
  // VIEW 2: MINIMAL DRAG & DROP UPLOAD CARD
  // =========================================================================
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
                  {file ? file.name : 'Select or drag & drop campus PDF circular'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {file
                    ? `${Math.round(file.size / 1024)} KB • Ready for extraction`
                    : 'PDF documents up to 25MB (Fee circulars, calendars, exam forms, notes)'}
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
