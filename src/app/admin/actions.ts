'use server'

import { createClient } from '@/utils/supabase/server'
import { verifyAdminAction } from '@/utils/auth'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { generateEmbedding } from '@/utils/embeddings'

export type ExtractedData = {
  title: string
  category: string
  audience: string
  department: string
  semester: string
  dates: string
  deadline: string | null
  priority: string
  rawText: string
  fileUrl: string
}

export async function parsePDF(formData: FormData): Promise<{ success: boolean; data?: ExtractedData; error?: string }> {
  try {
    // 0. Strict server-side authorization check (403 Forbidden if not admin)
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    const supabase = auth.supabase

    // 1. Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExt}`
    
    const { error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName)
    const fileUrl = publicUrlData.publicUrl

    // 2. Parse PDF Text
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rawText = await extractPdfText(buffer)

    // 3. Extract metadata using Groq
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { 
          role: 'system', 
          content: `You are a highly accurate data extraction assistant for a university administration system. 
Analyze the provided university document text and extract the required metadata into ONLY valid JSON.
Rules:
1. If a field like 'deadline' or 'semester' is not explicitly mentioned, return null. Do NOT guess.
2. Format dates strictly as YYYY-MM-DD.
3. Categorize the priority as HIGH only if it involves fees, exams, or strict deadlines within the next 7 days.

Schema:
{
  "title": "string",
  "category": "string",
  "audience": "string",
  "department": "string",
  "semester": "string or null",
  "dates": "string or null",
  "deadline": "string (YYYY-MM-DD or null)",
  "priority": "string (HIGH, MEDIUM, LOW)"
}`
        },
        { role: 'user', content: rawText }
      ],
      response_format: { type: 'json_object' }
    })

    const extractedContent = completion.choices[0]?.message?.content
    if (!extractedContent) {
      throw new Error("Failed to extract data from Groq")
    }

    const parsedJson = JSON.parse(extractedContent)

    return {
      success: true,
      data: {
        title: parsedJson.title || '',
        category: parsedJson.category || '',
        audience: parsedJson.audience || '',
        department: parsedJson.department || '',
        semester: parsedJson.semester || '',
        dates: parsedJson.dates || '',
        deadline: parsedJson.deadline || null,
        priority: parsedJson.priority || 'Medium',
        rawText,
        fileUrl,
      }
    }

  } catch (error: unknown) {
    console.error('Error in parsePDF:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

// Helper to chunk text roughly by word count
function chunkText(text: string, maxWords: number = 400): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

export async function publishDocument(data: ExtractedData) {
  try {
    // 0. Strict server-side authorization check (403 Forbidden if not admin)
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    // 1. Insert parent document
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        title: data.title,
        category: data.category,
        audience: data.audience,
        department: data.department,
        semester: data.semester,
        dates: data.dates,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        priority: data.priority,
        file_url: data.fileUrl,
        is_published: true
      })
      .select('id')
      .single()

    if (docError) throw new Error(`Document insert failed: ${docError.message}`)

    const documentId = docData.id

    // 2. Chunk the raw text and prepend metadata
    const rawChunks = chunkText(data.rawText, 400)
    
    const header = `[Context: Title: ${data.title} | Category: ${data.category} | Dept: ${data.department} | Deadline: ${data.deadline || 'None'} | Priority: ${data.priority}]`

    const enrichedChunks = rawChunks.map(chunk => `${header}\nRaw Text Segment: ${chunk}`)

    // 3. Embed enriched chunks locally using Xenova
    const embeddingsList: number[][] = []
    for (const chunk of enrichedChunks) {
      embeddingsList.push(await generateEmbedding(chunk))
    }

    // 4. Insert chunks into DB
    const chunkRows = enrichedChunks.map((chunkText, index) => ({
      document_id: documentId,
      chunk_text: chunkText,
      embedding: embeddingsList[index],
    }))

    const { error: chunksError } = await supabase
      .from('document_chunks')
      .insert(chunkRows)

    if (chunksError) throw new Error(`Chunks insert failed: ${chunksError.message}`)

    return { success: true }
  } catch (error: unknown) {
    console.error('Error in publishDocument:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function deletePublishedDocument(id: string, fileUrl: string) {
  try {
    // 0. Strict server-side authorization check (403 Forbidden if not admin)
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    // 1. Delete from Storage
    // Extract filename from URL
    const urlParts = fileUrl.split('/')
    const fileName = urlParts.pop()
    
    if (fileName) {
      await supabase.storage
        .from('documents')
        .remove([fileName])
    }

    // 2. Delete from Database (Cascade should delete chunks, but we can do it manually just in case)
    await supabase.from('document_chunks').delete().eq('document_id', id)
    
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Database delete failed: ${error.message}`)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting doc:', error)
    return { success: false, error: error.message }
  }
}
