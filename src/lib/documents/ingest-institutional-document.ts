import 'server-only'

import { chunkText } from '@/lib/documents/chunk-text'
import { generateEmbedding } from '@/utils/embeddings'
import { INSTITUTIONAL_BUCKET } from '@/utils/storage'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

type ProcessingDocument = {
  id: string
  storage_bucket: string
  storage_path: string
  uploaded_by: string
}

export async function ingestInstitutionalDocument(
  document: ProcessingDocument,
  adminId: string,
  rawText: string,
): Promise<void> {
  if (document.storage_bucket !== INSTITUTIONAL_BUCKET || document.uploaded_by !== adminId) {
    throw new Error('Institutional document ownership or storage location is invalid')
  }

  const chunks = chunkText(rawText)
  if (chunks.length === 0) throw new Error('No text could be extracted from the institutional PDF')

  const chunkRows = []
  for (let index = 0; index < chunks.length; index += 1) {
    chunkRows.push({
      document_id: document.id,
      chunk_index: index,
      content: chunks[index],
      embedding: await generateEmbedding(chunks[index]),
      page_number: null,
    })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('document_chunks').insert(chunkRows)
  if (error) throw new Error(`Failed to save institutional document chunks: ${error.message}`)
}
