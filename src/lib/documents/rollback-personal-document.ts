import 'server-only'

import { PERSONAL_BUCKET } from '@/utils/storage'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import type { SupabaseClient } from '@supabase/supabase-js'

type RollbackPersonalDocumentInput = {
  documentId: string | null
  studentId: string
  storagePath: string | null
  ownerClient: SupabaseClient
}

export async function rollbackPersonalDocument({
  documentId,
  studentId,
  storagePath,
  ownerClient,
}: RollbackPersonalDocumentInput): Promise<string[]> {
  let serviceClient: SupabaseClient | null = null
  try {
    serviceClient = createServiceRoleClient()
  } catch {
    serviceClient = null
  }

  let chunksError: string | null = null
  if (serviceClient && documentId) {
    try {
      const { error } = await serviceClient
        .from('personal_document_chunks')
        .delete()
        .eq('personal_document_id', documentId)
      chunksError = error?.message ?? null
    } catch (error: unknown) {
      chunksError = getErrorMessage(error)
    }
  }

  let documentRemoved = !documentId
  let documentError: string | null = null
  if (serviceClient && documentId) {
    try {
      const { error } = await serviceClient
        .from('personal_documents')
        .delete()
        .eq('id', documentId)
        .eq('student_id', studentId)
      documentError = error?.message ?? null
      documentRemoved = !error
    } catch (error: unknown) {
      documentError = getErrorMessage(error)
    }
  }

  if (!documentRemoved && documentId) {
    try {
      const { error } = await ownerClient
        .from('personal_documents')
        .delete()
        .eq('id', documentId)
        .eq('student_id', studentId)
      if (error) {
        documentError = `Trusted cleanup failed: ${documentError ?? 'unavailable'}; owner cleanup failed: ${error.message}`
      } else {
        documentRemoved = true
        documentError = null
      }
    } catch (error: unknown) {
      documentError = `Trusted cleanup failed: ${documentError ?? 'unavailable'}; owner cleanup failed: ${getErrorMessage(error)}`
    }
  }

  let storageRemoved = !storagePath
  let storageError: string | null = null
  if (serviceClient && storagePath) {
    try {
      const { error } = await serviceClient.storage.from(PERSONAL_BUCKET).remove([storagePath])
      storageError = error?.message ?? null
      storageRemoved = !error
    } catch (error: unknown) {
      storageError = getErrorMessage(error)
    }
  }

  if (!storageRemoved && storagePath) {
    try {
      const { error } = await ownerClient.storage.from(PERSONAL_BUCKET).remove([storagePath])
      if (error) {
        storageError = `Trusted cleanup failed: ${storageError ?? 'unavailable'}; owner cleanup failed: ${error.message}`
      } else {
        storageRemoved = true
        storageError = null
      }
    } catch (error: unknown) {
      storageError = `Trusted cleanup failed: ${storageError ?? 'unavailable'}; owner cleanup failed: ${getErrorMessage(error)}`
    }
  }

  const cleanupErrors: string[] = []
  if (!documentRemoved && documentError) {
    cleanupErrors.push(`Could not delete personal document: ${documentError}`)
  }
  if (!documentRemoved && chunksError) {
    cleanupErrors.push(`Could not delete personal chunks: ${chunksError}`)
  }
  if (!storageRemoved && storageError) {
    cleanupErrors.push(`Could not delete personal storage file: ${storageError}`)
  }

  return cleanupErrors
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
