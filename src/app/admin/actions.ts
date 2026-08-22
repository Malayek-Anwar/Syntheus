'use server'

import { createClient } from '@/utils/supabase/server'
import { verifyAdminAction } from '@/utils/auth'
import { normalizeAudience } from '@/utils/audience'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { generateEmbedding } from '@/utils/embeddings'

export type DocType = 
  | 'fee_notice' 
  | 'academic_calendar' 
  | 'holiday_notice' 
  | 'academic_notes' 
  | 'exam_circular' 
  | 'general_notice'

export type TimelineMilestone = {
  label: string
  date: string
  fee_penalty?: string | null
  description?: string | null
}

export type ExtractedData = {
  title: string
  doc_type: DocType
  category: string
  audience: string
  target_departments: string[]
  target_semesters: number[]
  summary: string
  key_points: string[]
  action_items: string[]
  timeline: TimelineMilestone[]
  dates: string
  deadline: string | null
  priority: string
  subject_code?: string | null
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

    // 3. Extract comprehensive institutional metadata using Groq
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { 
          role: 'system', 
          content: `You are an elite data extraction and institutional intelligence AI for a university administration system.
Analyze the provided university document text and extract rich, structured metadata into ONLY valid JSON.

Document Types:
- 'fee_notice': Fee payments, dues, registrations, examination fee circulars with payment windows or penalty fines.
- 'academic_calendar': Semester start/end, teaching schedules, vacation dates, mid-term evaluation weeks.
- 'holiday_notice': One-off holiday declarations, festival closures, compensatory working days.
- 'academic_notes': Study material, lecture notes, syllabus modules, lab manuals.
- 'exam_circular': Exam form filling, admit cards, hall tickets, seat matrices, practical/theory schedules.
- 'general_notice': Administrative rules, hostel, election, sports, dress code, workshops, placement drives.

Rules for Extraction:
1. 'doc_type': Pick strictly from ['fee_notice', 'academic_calendar', 'holiday_notice', 'academic_notes', 'exam_circular', 'general_notice'].
2. 'summary': 2-3 concise sentences in plain English summarizing what this document announces and its direct impact on students.
3. 'key_points': An array of 2-5 concise bullet points highlighting key rules, eligibility, or stipulations.
4. 'action_items': An array of 1-4 direct steps students must take (e.g. "Download Form 4B", "Pay ₹1,200 via ERP portal", "Submit receipt at Counter 2"). If purely informative, leave empty array [].
5. 'timeline': An array of milestone objects with { "label": string, "date": "YYYY-MM-DD", "fee_penalty": string | null, "description": string | null }.
   - If there are multiple deadlines (e.g. free submission date, late fee date, final closure date), extract EACH stage into the timeline array!
   - If there is a single deadline or event date, extract it as a 1-element array.
   - If no dates/deadlines exist, return [].
6. 'deadline': The primary/earliest urgent deadline as 'YYYY-MM-DD' (or null if no deadlines).
7. 'department': Target departments: 'CSE', 'ECE', 'ME', 'CE', 'IT', or 'All'.
8. 'semester': Target semesters: 'All', 'Odd', 'Even', or specific numbers (e.g. '3', '5', '1, 2').
9. 'subject_code': Extract subject code or course name if this document represents class notes / syllabus (e.g. "CS301", "Digital Electronics") or null.
10. 'priority': 'HIGH' if it involves impending deadlines, fines, or exam schedules; 'MEDIUM' for general academic updates; 'LOW' for routine circulars.

Schema:
{
  "title": "string",
  "doc_type": "fee_notice | academic_calendar | holiday_notice | academic_notes | exam_circular | general_notice",
  "category": "string",
  "audience": "string",
  "department": "string",
  "semester": "string",
  "summary": "string",
  "key_points": ["string"],
  "action_items": ["string"],
  "timeline": [
    {
      "label": "string",
      "date": "YYYY-MM-DD",
      "fee_penalty": "string or null",
      "description": "string or null"
    }
  ],
  "dates": "string or null",
  "deadline": "YYYY-MM-DD or null",
  "priority": "HIGH | MEDIUM | LOW",
  "subject_code": "string or null"
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

    // Normalize keywords into explicit target arrays
    const { target_departments, target_semesters } = normalizeAudience(
      parsedJson.department ?? parsedJson.target_departments,
      parsedJson.semester ?? parsedJson.target_semesters
    )

    // Ensure timeline is a clean array
    const rawTimeline = Array.isArray(parsedJson.timeline) ? parsedJson.timeline : []
    const timeline: TimelineMilestone[] = rawTimeline
      .filter((item: Record<string, unknown>) => item && typeof item.label === 'string' && typeof item.date === 'string')
      .map((item: Record<string, unknown>) => ({
        label: String(item.label),
        date: String(item.date),
        fee_penalty: item.fee_penalty ? String(item.fee_penalty) : null,
        description: item.description ? String(item.description) : null,
      }))

    // Determine primary deadline (first from timeline if not explicit)
    const deadline = parsedJson.deadline || timeline[0]?.date || null

    const validDocTypes: DocType[] = ['fee_notice', 'academic_calendar', 'holiday_notice', 'academic_notes', 'exam_circular', 'general_notice']
    const doc_type: DocType = validDocTypes.includes(parsedJson.doc_type) ? parsedJson.doc_type : 'general_notice'

    return {
      success: true,
      data: {
        title: parsedJson.title || '',
        doc_type,
        category: parsedJson.category || (doc_type === 'fee_notice' ? 'Fee & Dues' : doc_type === 'holiday_notice' ? 'Holiday' : 'Notice'),
        audience: parsedJson.audience || '',
        target_departments,
        target_semesters,
        summary: parsedJson.summary || '',
        key_points: Array.isArray(parsedJson.key_points) ? parsedJson.key_points : [],
        action_items: Array.isArray(parsedJson.action_items) ? parsedJson.action_items : [],
        timeline,
        dates: parsedJson.dates || '',
        deadline,
        priority: parsedJson.priority || 'Medium',
        subject_code: parsedJson.subject_code || null,
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

export async function publishDocument(data: ExtractedData, isDraft: boolean = false) {
  try {
    // 0. Strict server-side authorization check (403 Forbidden if not admin)
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    // Explicitly normalize and expand audience arrays before database insertion
    const { target_departments, target_semesters } = normalizeAudience(
      data.target_departments,
      data.target_semesters
    )

    const isPublished = !isDraft
    const status = isDraft ? 'draft' : 'published'

    // Construct full insert payload with new schema fields
    const insertPayload: Record<string, unknown> = {
      title: data.title,
      doc_type: data.doc_type || 'general_notice',
      category: data.category,
      audience: data.audience,
      target_departments,
      target_semesters,
      summary: data.summary || '',
      key_points: data.key_points || [],
      action_items: data.action_items || [],
      timeline: data.timeline || [],
      subject_code: data.subject_code || null,
      dates: data.dates,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      priority: data.priority,
      file_url: data.fileUrl,
      is_published: isPublished,
      is_archived: false,
      status: status,
    }

    // 1. Insert parent document with fallback support for base schema
    let documentId: string | null = null
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert(insertPayload)
      .select('id')
      .single()

    if (docError) {
      // If error was due to missing extended columns in database, fallback to base columns
      console.warn('Full schema insert failed, retrying with core columns:', docError.message)
      const basePayload = {
        title: data.title,
        category: data.category,
        audience: data.audience,
        target_departments,
        target_semesters,
        dates: data.dates,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        priority: data.priority,
        file_url: data.fileUrl,
        is_published: isPublished,
      }
      const { data: fallbackDoc, error: fallbackError } = await supabase
        .from('documents')
        .insert(basePayload)
        .select('id')
        .single()

      if (fallbackError) throw new Error(`Document insert failed: ${fallbackError.message}`)
      documentId = fallbackDoc.id
    } else {
      documentId = docData.id
    }

    if (!documentId) throw new Error('Failed to retrieve document ID after insert')

    // 2. Chunk the raw text and prepend metadata with AI summary and timeline for superior RAG recall
    const rawChunks = chunkText(data.rawText, 400)
    
    const deptStr = target_departments.length > 0 ? target_departments.join(', ') : 'All'
    const semStr = target_semesters.length > 0 ? target_semesters.join(', ') : 'All'
    const timelineStr = data.timeline && data.timeline.length > 0 ? JSON.stringify(data.timeline) : (data.deadline || 'None')
    const header = `[Context: Title: ${data.title} | Type: ${data.doc_type || data.category} | Summary: ${data.summary || ''} | Depts: ${deptStr} | Sems: ${semStr} | Deadlines/Timeline: ${timelineStr} | Priority: ${data.priority}]`

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

    return { success: true, documentId, isPublished }
  } catch (error: unknown) {
    console.error('Error in publishDocument:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export type UpdateDocumentPayload = {
  id: string
  title: string
  doc_type: DocType
  category: string
  audience?: string
  target_departments: string[]
  target_semesters: number[]
  summary: string
  key_points: string[]
  action_items: string[]
  timeline: TimelineMilestone[]
  dates: string
  deadline: string | null
  priority: string
  subject_code?: string | null
  is_published?: boolean
  is_archived?: boolean
  status?: 'published' | 'draft' | 'archived'
}

export async function updateDocument(payload: UpdateDocumentPayload) {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    const { target_departments, target_semesters } = normalizeAudience(
      payload.target_departments,
      payload.target_semesters
    )

    const updatePayload: Record<string, unknown> = {
      title: payload.title,
      doc_type: payload.doc_type || 'general_notice',
      category: payload.category,
      audience: target_departments.join(', '),
      target_departments,
      target_semesters,
      summary: payload.summary || '',
      key_points: payload.key_points || [],
      action_items: payload.action_items || [],
      timeline: payload.timeline || [],
      subject_code: payload.subject_code || null,
      dates: payload.dates,
      deadline: payload.deadline ? new Date(payload.deadline).toISOString() : null,
      priority: payload.priority,
    }

    if (typeof payload.is_published === 'boolean') {
      updatePayload.is_published = payload.is_published
    }
    if (typeof payload.is_archived === 'boolean') {
      updatePayload.is_archived = payload.is_archived
    }
    if (payload.status) {
      updatePayload.status = payload.status
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', payload.id)

    if (updateError) {
      console.warn('Full update failed, trying fallback without lifecycle columns:', updateError.message)
      const fallbackPayload: Record<string, unknown> = {
        title: payload.title,
        doc_type: payload.doc_type || 'general_notice',
        category: payload.category,
        audience: target_departments.join(', '),
        target_departments,
        target_semesters,
        summary: payload.summary || '',
        key_points: payload.key_points || [],
        action_items: payload.action_items || [],
        timeline: payload.timeline || [],
        subject_code: payload.subject_code || null,
        dates: payload.dates,
        deadline: payload.deadline ? new Date(payload.deadline).toISOString() : null,
        priority: payload.priority,
      }
      if (typeof payload.is_published === 'boolean') {
        fallbackPayload.is_published = payload.is_published
      }
      const { error: fallbackErr } = await supabase
        .from('documents')
        .update(fallbackPayload)
        .eq('id', payload.id)

      if (fallbackErr) throw new Error(`Document update failed: ${fallbackErr.message}`)
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error in updateDocument:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function toggleDocumentLifecycle(id: string, action: 'publish' | 'draft' | 'archive' | 'restore') {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    let updateData: Record<string, unknown> = {}
    if (action === 'publish' || action === 'restore') {
      updateData = { is_published: true, is_archived: false, status: 'published' }
    } else if (action === 'draft') {
      updateData = { is_published: false, is_archived: false, status: 'draft' }
    } else if (action === 'archive') {
      updateData = { is_published: false, is_archived: true, status: 'archived' }
    }

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)

    if (error) {
      // Fallback if status/is_archived columns are not present
      const fallbackData = { is_published: action === 'publish' || action === 'restore' }
      const { error: fallbackError } = await supabase
        .from('documents')
        .update(fallbackData)
        .eq('id', id)

      if (fallbackError) throw new Error(fallbackError.message)
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error toggling lifecycle status:', error)
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
  } catch (error: unknown) {
    console.error('Error deleting doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
