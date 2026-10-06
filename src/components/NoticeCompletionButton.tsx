'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markNoticeFinished, markNoticeUnfinished } from '@/app/student/attention/actions'

export function NoticeCompletionButton({ noticeId, isCompleted = false }: { noticeId: string; isCompleted?: boolean }) {
  const [completedOverride, setCompletedOverride] = useState<boolean | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const completed = completedOverride !== null ? completedOverride : isCompleted

  const handleToggle = async () => {
    if (!noticeId || isSaving) return
    setIsSaving(true)

    try {
      const nextState = !completed
      const result = completed
        ? await markNoticeUnfinished(noticeId)
        : await markNoticeFinished(noticeId)

      if (result.success) {
        setCompletedOverride(nextState)
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to toggle notice completion:', err)
    } finally {
      setIsSaving(false)
    }
  }

  if (!noticeId) return null

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSaving}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer flex-shrink-0 ${
        completed
          ? 'border border-[#cce5df] bg-[#edf6f3] text-[#176b61] hover:bg-[#dceee9]'
          : 'border border-[#d7cda9] bg-white/70 text-[#756843] hover:bg-[#f5f3eb]'
      }`}
    >
      <span aria-hidden="true">{completed ? '✓' : '○'}</span>
      <span>{isSaving ? 'Saving...' : completed ? 'Finished' : 'Mark done'}</span>
    </button>
  )
}
