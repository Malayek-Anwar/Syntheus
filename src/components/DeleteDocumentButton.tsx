'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deletePersonalDocument } from '@/app/student/my-documents/actions'
import { ConfirmModal } from '@/components/ConfirmModal'
import { getErrorMessage } from '@/utils/errors'

export function DeleteDocumentButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const result = await deletePersonalDocument(id)
      
      if (!result.success) {
        setError(result.error || 'Failed to delete document')
        setIsModalOpen(false)
        return
      }

      setIsModalOpen(false)
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err))
      setIsModalOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isDeleting}
        className="ml-2 flex-shrink-0 bg-white border border-red-200 text-red-600 px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>

      {error && (
        <span className="text-xs text-red-600 ml-2" role="alert">
          ⚠️ {error}
        </span>
      )}

      <ConfirmModal
        isOpen={isModalOpen}
        title="Delete Private Document"
        message="Are you sure you want to delete this document? This will remove the file from encrypted storage permanently."
        confirmText="Delete Document"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsModalOpen(false)}
      />
    </>
  )
}
