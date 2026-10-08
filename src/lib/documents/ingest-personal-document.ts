import 'server-only'

import { chunkText } from '@/lib/documents/chunk-text'
import { extractPdfText } from '@/lib/documents/extract-pdf'
import { generateEmbedding } from '@/utils/embeddings'
import { PERSONAL_BUCKET } from '@/utils/storage'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

type IngestPersonalDocumentInput = {
  documentId: string
  studentId: string
}

export async function ingestPersonalDocument({
  documentId,
  studentId,
}: IngestPersonalDocumentInput): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: document, error: documentError } = await supabase
    .from('personal_documents')
    .select('id, title, storage_bucket, storage_path, status')
    .eq('id', documentId)
    .eq('student_id', studentId)
    .eq('status', 'processing')
    .maybeSingle()

  if (documentError) {
    throw new Error(`Failed to load personal document for ingestion: ${documentError.message}`)
  }
  if (!document) {
    throw new Error('Personal document is not available for processing')
  }
  if (
    document.storage_bucket !== PERSONAL_BUCKET
    || !document.storage_path.startsWith(`${studentId}/`)
  ) {
    throw new Error('Personal document storage location is invalid')
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(PERSONAL_BUCKET)
    .download(document.storage_path)
  if (downloadError || !file) {
    throw new Error(`Failed to download personal document: ${downloadError?.message ?? 'File not found'}`)
  }

  const rawText = await extractPdfText(Buffer.from(await file.arrayBuffer()))
  const chunks = chunkText(rawText)
  if (chunks.length === 0) {
    throw new Error('No text could be extracted from the uploaded PDF')
  }

  const chunkRows = []
  for (let index = 0; index < chunks.length; index += 1) {
    const content = `[Personal Document: "${document.title}"]\n${chunks[index]}`
    chunkRows.push({
      personal_document_id: document.id,
      chunk_index: index,
      content,
      embedding: await generateEmbedding(content),
      page_number: null,
    })
  }

  const { error: chunksError } = await supabase
    .from('personal_document_chunks')
    .insert(chunkRows)
  if (chunksError) {
    throw new Error(`Failed to save personal document chunks: ${chunksError.message}`)
  }

  const { data: readyDocument, error: statusError } = await supabase
    .from('personal_documents')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', document.id)
    .eq('student_id', studentId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle()

  if (statusError) {
    throw new Error(`Failed to mark personal document ready: ${statusError.message}`)
  }
  if (!readyDocument) {
    throw new Error('Personal document status changed during ingestion')
  }
}
