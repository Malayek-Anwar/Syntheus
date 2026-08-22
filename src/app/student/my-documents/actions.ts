'use server'

import { createClient } from '@/utils/supabase/server'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
import { extractPersonalStoragePath } from '@/utils/storage'
import { v4 as uuidv4 } from 'uuid'

export async function uploadPersonalDocument(formData: FormData) {
  try {
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    
    if (!file || !title) {
      return { success: false, error: 'File and title are required' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // 1. Upload to Supabase Storage (personal_documents bucket)
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${uuidv4()}.${fileExt}`
    
    const { error: uploadError } = await supabase
      .storage
      .from('personal_documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return { success: false, error: `Storage upload failed: ${uploadError.message}` }
    }

    // 2. Parse PDF Text
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rawText = await extractPdfText(buffer)

    // 3. Generate Embedding using Local Xenova model
    const { generateEmbedding } = await import('@/utils/embeddings')
    
    const truncatedText = rawText.slice(0, 8000)
    const textToEmbed = `Title: ${title}\n\nContent: ${truncatedText}`

    const embedding = await generateEmbedding(textToEmbed)

    // 4. Save to Database with private storage path
    const { error: dbError } = await supabase
      .from('personal_documents')
      .insert({
        user_id: user.id,
        title,
        file_url: fileName,
        embedding
      })

    if (dbError) throw new Error(`Database insert failed: ${dbError.message}`)

    return { success: true }
  } catch (error: unknown) {
    console.error('Error uploading personal doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function deletePersonalDocument(id: string, fileUrl: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // 1. Delete from Storage
    const storagePath = extractPersonalStoragePath(fileUrl)
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('personal_documents')
        .remove([storagePath])

      if (storageError) {
        console.warn('Storage deletion warning:', storageError)
      }
    }

    // 2. Delete from Database
    const { error } = await supabase
      .from('personal_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure they only delete their own

    if (error) throw new Error(`Database delete failed: ${error.message}`)

    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
