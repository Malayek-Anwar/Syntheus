'use server'

import { createClient } from '@/utils/supabase/server'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
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
      // If bucket doesn't exist or RLS blocks it, this fails
      console.error(uploadError)
      return { success: false, error: `Storage upload failed. Did you create the personal_documents bucket? ${uploadError.message}` }
    }

    const { data: publicUrlData } = supabase.storage.from('personal_documents').getPublicUrl(fileName)
    const fileUrl = publicUrlData.publicUrl

    // 2. Parse PDF Text
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rawText = await extractPdfText(buffer)

    // 3. Generate Embedding using Local Xenova model
    const { generateEmbedding } = await import('@/utils/embeddings')
    
    // We take the first 8000 characters
    const truncatedText = rawText.slice(0, 8000)
    const textToEmbed = `Title: ${title}\n\nContent: ${truncatedText}`

    const embedding = await generateEmbedding(textToEmbed)

    // 4. Save to Database
    const { error: dbError } = await supabase
      .from('personal_documents')
      .insert({
        user_id: user.id,
        title,
        file_url: fileUrl,
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
    // Extract filename from URL (assumes format: .../personal_documents/userId/uuid.ext)
    const urlParts = fileUrl.split('/')
    const fileName = urlParts.pop()
    const folderName = urlParts.pop()
    
    if (folderName && fileName) {
      await supabase.storage
        .from('personal_documents')
        .remove([`${folderName}/${fileName}`])
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
