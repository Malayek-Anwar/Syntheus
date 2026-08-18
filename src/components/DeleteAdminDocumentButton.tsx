'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deletePublishedDocument } from '@/app/admin/actions'

export function DeleteAdminDocumentButton({ id, fileUrl }: { id: string, fileUrl: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campus document? This will remove it from the knowledge base completely.')) return

    setIsDeleting(true)
    const result = await deletePublishedDocument(id, fileUrl)
    
    if (!result.success) {
      alert(result.error || 'Failed to delete')
      setIsDeleting(false)
      return
    }

    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="ml-4 flex-shrink-0 bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-50"
    >
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  )
}
