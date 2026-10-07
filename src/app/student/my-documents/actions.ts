'use server'

import { verifyStudentSession } from '@/utils/auth'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
import { PERSONAL_BUCKET, extractPersonalStoragePath } from '@/utils/storage'
import { generateEmbedding } from '@/utils/embeddings'
import { v4 as uuidv4 } from 'uuid'

function chunkText(text: string, maxWords: number = 300): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

export async function uploadPersonalDocument(formData: FormData) {
  let uploadedStoragePath: string | null = null

  try {
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: auth.error || 'Active student authentication required' }
    }

    const file = formData.get('file') as File
    const title = (formData.get('title') as string)?.trim()

    if (!file || !title) {
      return { success: false, error: 'File and title are required' }
    }

    if (file.type !== 'application/pdf') {
      return { success: false, error: 'Only PDF documents are supported in V1' }
    }

    const supabase = auth.supabase
    const studentId = auth.student.id

    // 1. Upload to Supabase Storage: personal-documents/<student_id>/<uuid>.pdf
    const fileExt = file.name.split('.').pop() || 'pdf'
    const fileName = `${studentId}/${uuidv4()}.${fileExt}`
    uploadedStoragePath = fileName

    const { error: uploadError } = await supabase
      .storage
      .from(PERSONAL_BUCKET)
      .upload(fileName, file, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { success: false, error: `Storage upload failed: ${uploadError.message}` }
    }

    // 2. Parse PDF Text
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rawText = await extractPdfText(buffer)

    // 3. Insert into personal_documents
    const { data: docData, error: dbError } = await supabase
      .from('personal_documents')
      .insert({
        student_id: studentId,
        title,
        description: null,
        status: 'ready',
        storage_bucket: PERSONAL_BUCKET,
        storage_path: fileName,
        mime_type: 'application/pdf',
        file_size: file.size,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (dbError || !docData) {
      throw new Error(`Database insert failed: ${dbError?.message}`)
    }

    const personalDocId = docData.id

    // 4. Chunk text and generate vector embeddings
    const rawChunks = chunkText(rawText, 300)
    const chunkRows = []

    for (let idx = 0; idx < rawChunks.length; idx++) {
      const chunk = rawChunks[idx]
      const enrichedContent = `[Personal Document: "${title}"]\n${chunk}`
      const embedding = await generateEmbedding(enrichedContent)

      chunkRows.push({
        personal_document_id: personalDocId,
        chunk_index: idx,
        content: enrichedContent,
        embedding,
        page_number: null,
      })
    }

    if (chunkRows.length > 0) {
      const { error: chunksError } = await supabase
        .from('personal_document_chunks')
        .insert(chunkRows)

      if (chunksError) {
        throw new Error(`Personal chunks insert failed: ${chunksError.message}`)
      }
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error uploading personal doc:', error)
    if (uploadedStoragePath) {
      try {
        const auth = await verifyStudentSession()
        if (auth.supabase) {
          await auth.supabase.storage.from(PERSONAL_BUCKET).remove([uploadedStoragePath])
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup personal storage file:', cleanupErr)
      }
    }
    return { success: false, error: getErrorMessage(error) }
  }
}

/**
 * Deletes a personal document following Section 20:
 * 1. Disassociate message_sources.personal_document_id = NULL (retaining source_title)
 * 2. Delete personal_documents row (cascades to personal_document_chunks)
 * 3. Delete physical file from personal-documents bucket
 */
export async function deletePersonalDocument(id: string, storagePathOrUrl: string) {
  try {
    const auth = await verifyStudentSession()
    if (!auth.authorized || !auth.student) {
      return { success: false, error: auth.error || 'Active student authentication required' }
    }

    const supabase = auth.supabase
    const studentId = auth.student.id

    // 1. Disassociate from message_sources
    await supabase
      .from('message_sources')
      .update({ personal_document_id: null })
      .eq('personal_document_id', id)

    // 2. Delete database record
    const { error: deleteError } = await supabase
      .from('personal_documents')
      .delete()
      .eq('id', id)
      .eq('student_id', studentId) // Strict owner check

    if (deleteError) throw new Error(`Database delete failed: ${deleteError.message}`)

    // 3. Delete from Storage
    const storagePath = extractPersonalStoragePath(storagePathOrUrl)
    if (storagePath) {
      await supabase.storage
        .from(PERSONAL_BUCKET)
        .remove([storagePath])
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting personal doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
