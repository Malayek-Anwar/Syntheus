'use server'

import { verifyStudentSession } from '@/utils/auth'
import { getErrorMessage } from '@/utils/errors'
import { PERSONAL_BUCKET } from '@/utils/storage'
import { ingestPersonalDocument } from '@/lib/documents/ingest-personal-document'
import { rollbackPersonalDocument } from '@/lib/documents/rollback-personal-document'
import { validatePdfUpload } from '@/lib/documents/validate-pdf-upload'
import { v4 as uuidv4 } from 'uuid'

export async function uploadPersonalDocument(formData: FormData) {
  let uploadedStoragePath: string | null = null
  let storageUploadAttempted = false
  let personalDocumentId: string | null = null
  let supabase: Awaited<ReturnType<typeof verifyStudentSession>>['supabase'] | null = null
  let studentId: string | null = null

  try {
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: auth.error || 'Active student authentication required' }
    }

    const file = formData.get('file')
    const titleValue = formData.get('title')
    const title = typeof titleValue === 'string' ? titleValue.trim() : ''

    if (!title) {
      return { success: false, error: 'File and title are required' }
    }
    const { file: pdfFile, buffer } = await validatePdfUpload(file)

    supabase = auth.supabase
    const ownerStudentId = auth.student.id
    studentId = ownerStudentId

    // 1. Create the owner-scoped document in processing state.
    const fileName = `${ownerStudentId}/${uuidv4()}.pdf`
    uploadedStoragePath = fileName

    const { data: docData, error: dbError } = await supabase
      .from('personal_documents')
      .insert({
        student_id: ownerStudentId,
        title,
        description: null,
        status: 'processing',
        storage_bucket: PERSONAL_BUCKET,
        storage_path: fileName,
        mime_type: 'application/pdf',
        file_size: pdfFile.size,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (dbError || !docData) {
      throw new Error(`Database insert failed: ${dbError?.message}`)
    }

    personalDocumentId = docData.id

    // 2. Upload the PDF, then ingest it through trusted server-side code.
    storageUploadAttempted = true
    const { error: uploadError } = await supabase
      .storage
      .from(PERSONAL_BUCKET)
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    await ingestPersonalDocument({ documentId: docData.id, studentId: ownerStudentId })

    return { success: true }
  } catch (error: unknown) {
    console.error('Error uploading personal doc:', error)
    let cleanupErrors: string[] = []
    if (supabase && studentId) {
      cleanupErrors = await rollbackPersonalDocument({
        documentId: personalDocumentId,
        studentId,
        storagePath: storageUploadAttempted ? uploadedStoragePath : null,
        ownerClient: supabase,
      })
      if (cleanupErrors.length > 0) {
        console.error('Personal document rollback was incomplete:', cleanupErrors)
      }
    }
    const errorMessage = getErrorMessage(error)
    return {
      success: false,
      error: cleanupErrors.length > 0
        ? `${errorMessage} Cleanup also failed: ${cleanupErrors.join('; ')}`
        : errorMessage,
    }
  }
}

/**
 * Deletes a personal document following Section 20:
 * 1. Disassociate message_sources.personal_document_id = NULL (retaining source_title)
 * 2. Delete personal_documents row (cascades to personal_document_chunks)
 * 3. Delete physical file from personal-documents bucket
 */
export async function deletePersonalDocument(id: string) {
  try {
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: auth.error || 'Active student authentication required' }
    }

    const supabase = auth.supabase
    const studentId = auth.student.id

    const { data: document, error: documentError } = await supabase
      .from('personal_documents')
      .select('id, storage_bucket, storage_path')
      .eq('id', id)
      .eq('student_id', studentId)
      .single()
    if (documentError || !document) {
      throw new Error(`Personal document not found: ${documentError?.message ?? ''}`)
    }
    if (
      document.storage_bucket !== PERSONAL_BUCKET
      || !document.storage_path.startsWith(`${studentId}/`)
    ) {
      throw new Error('Personal document storage location is invalid')
    }

    // 1. Disassociate from message_sources
    const { error: sourcesError } = await supabase
      .from('message_sources')
      .update({ personal_document_id: null })
      .eq('personal_document_id', id)
    if (sourcesError) throw new Error(`Failed to preserve personal document citations: ${sourcesError.message}`)

    // 2. Delete database record
    const { error: deleteError } = await supabase
      .from('personal_documents')
      .delete()
      .eq('id', id)
      .eq('student_id', studentId) // Strict owner check

    if (deleteError) throw new Error(`Database delete failed: ${deleteError.message}`)

    // 3. Delete from Storage
    const { error: storageError } = await supabase.storage
      .from(PERSONAL_BUCKET)
      .remove([document.storage_path])
    if (storageError) {
      throw new Error(`Personal document was deleted, but its PDF cleanup failed: ${storageError.message}`)
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting personal doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
