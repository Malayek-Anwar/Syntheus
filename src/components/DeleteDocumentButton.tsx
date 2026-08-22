'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deletePersonalDocument } from '@/app/student/my-documents/actions'
import { ConfirmModal } from '@/components/ConfirmModal'

export function DeleteDocumentButton({ id, fileUrl }: { id: string, fileUrl: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    setError(null)

    const result = await deletePersonalDocument(id, fileUrl)
    
    if (!result.success) {
      setError(result.error || 'Failed to delete document')
      setIsDeleting(false)
      setIsModalOpen(false)
      return
    }

    setIsModalOpen(false)
    setIsDeleting(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={isDeleting}
        className="ml-2 flex-shrink-0 bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>

      {error && (
        <span className="text-xs text-red-600 ml-2" title={error}>
          ⚠️ Error deleting
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
