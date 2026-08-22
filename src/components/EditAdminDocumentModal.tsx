'use client'

import { useState } from 'react'
import { updateDocument, type DocType, type TimelineMilestone } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'

const DOC_TYPE_OPTIONS: { type: DocType; label: string; icon: string; desc: string }[] = [
  { type: 'fee_notice', label: 'Fee & Dues', icon: '💳', desc: 'Tiered deadlines & fine penalties' },
  { type: 'academic_calendar', label: 'Academic Calendar', icon: '📅', desc: 'Semester milestones & schedules' },
  { type: 'holiday_notice', label: 'Holiday Notice', icon: '🎉', desc: 'One-off campus closures' },
  { type: 'academic_notes', label: 'Class Notes / Syllabus', icon: '📚', desc: 'Lecture modules & study materials' },
  { type: 'exam_circular', label: 'Exam Circular', icon: '📝', desc: 'Admit cards, forms & schedules' },
  { type: 'general_notice', label: 'General Notice', icon: '📢', desc: 'Administrative & campus rules' },
]

const ALL_DEPTS = ['CSE', 'ECE', 'ME', 'CE', 'IT']
const ALL_SEMS = [1, 2, 3, 4, 5, 6, 7, 8]

export interface AdminDocumentItem {
  id: string
  title: string
  category?: string | null
  doc_type?: string | null
  summary?: string | null
  key_points?: string[] | null
  action_items?: string[] | null
  timeline?: TimelineMilestone[] | null
  dates?: string | null
  deadline?: string | null
  priority?: string | null
  audience?: string | null
  target_departments?: string[] | null
  target_semesters?: number[] | null
  subject_code?: string | null
  file_url: string
  created_at: string
  is_published?: boolean | null
  is_archived?: boolean | null
  status?: string | null
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
  const [selectedDocType, setSelectedDocType] = useState<DocType>((document.doc_type as DocType) || 'general_notice')
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    document.target_departments && document.target_departments.length > 0 ? document.target_departments : ['All']
  )
  const [selectedSems, setSelectedSems] = useState<number[]>(document.target_semesters || [])
  const [timelineItems, setTimelineItems] = useState<TimelineMilestone[]>(document.timeline || [])
  const [currentStatus, setCurrentStatus] = useState<'published' | 'draft' | 'archived'>(
    document.is_archived ? 'archived' : document.is_published === false ? 'draft' : 'published'
  )
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

    const formData = new FormData(e.currentTarget)

    const keyPointsRaw = formData.get('key_points') as string
    const key_points = keyPointsRaw
      ? keyPointsRaw.split('\n').map(line => line.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
      : document.key_points || []

    const actionItemsRaw = formData.get('action_items') as string
    const action_items = actionItemsRaw
      ? actionItemsRaw.split('\n').map(line => line.replace(/^(\d+\.|\-|\*|\[\s*\])\s*/, '').trim()).filter(Boolean)
      : document.action_items || []

    const is_published = currentStatus === 'published'
    const is_archived = currentStatus === 'archived'

    const result = await updateDocument({
      id: document.id,
      title: (formData.get('title') as string) || document.title,
      doc_type: selectedDocType,
      category: (formData.get('category') as string) || document.category || 'General',
      audience: selectedDepts.join(', '),
      target_departments: selectedDepts,
      target_semesters: selectedSems,
      summary: (formData.get('summary') as string) || document.summary || '',
      key_points,
      action_items,
      timeline: timelineItems,
      dates: (formData.get('dates') as string) || document.dates || '',
      deadline: (formData.get('deadline') as string) || null,
      priority: (formData.get('priority') as string) || document.priority || 'Medium',
      subject_code: (formData.get('subject_code') as string) || null,
      is_published,
      is_archived,
      status: currentStatus,
    })

    if (!result.success) {
      setError(result.error || 'Failed to update document')
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>✏️</span> Edit Notice & Document Intelligence
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Update metadata, milestones, audience tags, and publication state.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {/* Status & Lifecycle Banner */}
          <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3.5 space-y-2">
            <span className="text-xs font-bold text-blue-950 uppercase tracking-wider block">
              Publication Lifecycle Status
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCurrentStatus('published')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  currentStatus === 'published'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>🟢</span>
                <span>Published (Live)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStatus('draft')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  currentStatus === 'draft'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>🟡</span>
                <span>Draft (Hidden)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStatus('archived')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  currentStatus === 'archived'
                    ? 'bg-gray-700 text-white border-gray-700 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>📦</span>
                <span>Archived</span>
              </button>
            </div>
          </div>

          {/* 1. Archetype Classification */}
          <div>
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
              Circular Archetype
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOC_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setSelectedDocType(opt.type)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedDocType === opt.type
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-2xs'
                      : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 line-clamp-1">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notice Title</label>
              <input
                type="text"
                name="title"
                defaultValue={document.title}
                required
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category Label</label>
              <input
                type="text"
                name="category"
                defaultValue={document.category || 'General'}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
              />
            </div>
          </div>

          {/* 3. AI Executive Summary */}
          <div className="bg-blue-50/40 rounded-xl border border-blue-200/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                ✨ AI Executive Summary
              </label>
              <span className="text-[11px] text-blue-700 font-medium bg-blue-100/70 px-2 py-0.5 rounded">
                Plain-English Brief
              </span>
            </div>
            <textarea
              name="summary"
              rows={3}
              defaultValue={document.summary || ''}
              className="w-full rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 leading-relaxed focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
              placeholder="Executive brief of this notice..."
            />
          </div>

          {/* 4. Key Takeaways & Action Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                📌 Key Takeaways & Rules (One per line)
              </label>
              <textarea
                name="key_points"
                rows={4}
                defaultValue={(document.key_points || []).map(p => `• ${p}`).join('\n')}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 leading-relaxed focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
                placeholder="• Rule 1&#10;• Rule 2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                ✅ Action Checklist for Students (One per line)
              </label>
              <textarea
                name="action_items"
                rows={4}
                defaultValue={(document.action_items || []).map((a, i) => `${i + 1}. ${a}`).join('\n')}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs text-gray-900 leading-relaxed focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
                placeholder="1. Action step 1&#10;2. Action step 2"
              />
            </div>
          </div>

          {/* 5. Multi-Stage Timeline & Milestones */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                ⏳ Multi-Stage Deadlines & Milestone Timeline
              </span>
              <button
                type="button"
                onClick={() => {
                  setTimelineItems([
                    ...timelineItems,
                    { label: 'New Stage', date: new Date().toISOString().split('T')[0], fee_penalty: null, description: null }
                  ])
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs cursor-pointer"
              >
                + Add Stage
              </button>
            </div>

            {timelineItems.length > 0 ? (
              <div className="space-y-2">
                {timelineItems.map((m, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs text-xs">
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) => {
                        const next = [...timelineItems]
                        next[idx].label = e.target.value
                        setTimelineItems(next)
                      }}
                      placeholder="Stage Label (e.g. Without Fine)"
                      className="flex-1 min-w-[140px] px-2 py-1 rounded border border-gray-200 font-semibold text-gray-900"
                    />
                    <input
                      type="text"
                      value={m.fee_penalty || ''}
                      onChange={(e) => {
                        const next = [...timelineItems]
                        next[idx].fee_penalty = e.target.value || null
                        setTimelineItems(next)
                      }}
                      placeholder="Penalty (e.g. ₹500 Late Fee)"
                      className="w-32 px-2 py-1 rounded border border-gray-200 text-orange-700 font-medium"
                    />
                    <input
                      type="date"
                      value={m.date}
                      onChange={(e) => {
                        const next = [...timelineItems]
                        next[idx].date = e.target.value
                        setTimelineItems(next)
                      }}
                      className="px-2 py-1 rounded border border-gray-200 font-mono text-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => setTimelineItems(timelineItems.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 px-1.5 py-1 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No multi-stage deadlines set.</p>
            )}
          </div>

          {/* 6. Audience Targeting */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider">
              🎯 Target Audience Filtering
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
                  Campus Wide (All)
                </button>
                {ALL_DEPTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      selectedDepts.includes(dept) && !selectedDepts.includes('All')
                        ? 'bg-blue-600 text-white border-blue-600'
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
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    S{sem}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 7. Deadline & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Deadline</label>
              <input
                type="date"
                name="deadline"
                defaultValue={document.deadline ? new Date(document.deadline).toISOString().split('T')[0] : ''}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Priority Level</label>
              <select
                name="priority"
                defaultValue={document.priority || 'Medium'}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs outline-none"
              >
                <option value="High">🔴 High Priority (Action Required)</option>
                <option value="Medium">🟡 Medium Priority (Standard Notice)</option>
                <option value="Low">⚪ Low Priority (Informational)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer transition-all flex items-center gap-2"
            >
              {isSaving ? 'Saving Changes...' : 'Save & Update Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
