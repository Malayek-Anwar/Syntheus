'use server'

import { verifyAdminAction } from '@/utils/auth'
import { normalizeAudience } from '@/utils/audience'
import { getErrorMessage } from '@/utils/errors'
import { extractPdfText } from '@/utils/pdf'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import { generateEmbedding } from '@/utils/embeddings'
import { INSTITUTIONAL_BUCKET, extractStoragePath, getInstitutionalSignedUrl } from '@/utils/storage'
import type { DocumentCategory, AcademicEventType } from '@/types/database'
import { ALL_DOCUMENT_CATEGORIES } from '@/utils/constants'

export type CandidateEvent = {
  title: string
  description?: string | null
  event_type: AcademicEventType
  starts_at: string
  ends_at?: string | null
  all_day?: boolean
}

export type CandidateTimetableEntry = {
  day_of_week: number
  start_time: string
  end_time: string
  subject: string
  room?: string | null
  instructor?: string | null
}

export type CandidateTimetable = {
  name: string
  valid_from: string
  valid_until?: string | null
  entries: CandidateTimetableEntry[]
}

export type ExtractedData = {
  title: string
  description: string
  category: DocumentCategory
  tracks_completion: boolean
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  expires_at: string | null
  candidate_events: CandidateEvent[]
  candidate_timetable: CandidateTimetable | null
  rawText: string
  storagePath: string
  storageBucket: string
  fileSize: number
  signedUrl: string
}

export async function parsePDF(formData: FormData): Promise<{ success: boolean; data?: ExtractedData; error?: string }> {
  let uploadedStoragePath: string | null = null

  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized || !auth.admin) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    const supabase = auth.supabase

    // 1. Upload to Supabase Storage (institutional-documents private bucket)
    const fileExt = file.name.split('.').pop() || 'pdf'
    const fileName = `${uuidv4()}.${fileExt}`
    uploadedStoragePath = fileName

    const { error: uploadError } = await supabase
      .storage
      .from(INSTITUTIONAL_BUCKET)
      .upload(fileName, file, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    const signedUrl = await getInstitutionalSignedUrl(supabase, fileName, 3600)
    if (!signedUrl) {
      throw new Error('Failed to generate preview signed URL for uploaded PDF')
    }

    // 2. Parse PDF Text
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const rawText = await extractPdfText(buffer)

    // 3. Extract institutional intelligence using Groq
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: `You are an institutional intelligence data extraction AI for a university portal called Syntheus.
Analyze the provided university document and extract structured metadata into valid JSON only.

Permitted Document Categories:
- Institute: 'notice', 'circular', 'schedule', 'calendar', 'syllabus', 'form', 'admission', 'registration', 'scholarship', 'placement', 'fees'
- Study: 'notes', 'reference_material', 'question_paper', 'question_bank', 'assignment'

Permitted Academic Event Types:
- 'exam', 'assignment_deadline', 'registration_deadline', 'admission_deadline', 'scholarship_deadline', 'semester_start', 'semester_end', 'holiday', 'class_event', 'other'

Instructions:
1. 'category': Must be strictly one of the 16 permitted categories above.
2. 'description': Concise summary of the document (2-3 sentences).
3. 'tracks_completion': true if this represents an actionable item (e.g. form filling, assignment, notice requiring action), else false.
4. 'expires_at': ISO date string (YYYY-MM-DD or full timestamp) if notice has a deadline/cutoff after which it becomes historical, or null.
5. 'target_departments': array of department codes ('CSE', 'ECE', 'ME', 'CE', 'IT') or null for all departments.
6. 'target_semesters': array of integer semesters (1 to 8) or null for all semesters.
7. 'target_sections': array of uppercase section letters (e.g. ['A', 'B']) or null for all sections.
8. 'candidate_events': Extract any structured calendar events (e.g. exam dates, assignment deadlines, holiday dates) into an array of objects:
   { "title": string, "event_type": AcademicEventType, "starts_at": "YYYY-MM-DDTHH:mm:ssZ" or "YYYY-MM-DD", "ends_at": string or null, "all_day": boolean }
9. 'candidate_timetable': If this document is a class/lecture timetable, extract:
   { "name": string, "valid_from": "YYYY-MM-DD", "valid_until": "YYYY-MM-DD" or null, "entries": [ { "day_of_week": 1-7 (Mon=1, Sun=7), "start_time": "HH:MM:SS", "end_time": "HH:MM:SS", "subject": string, "room": string or null, "instructor": string or null } ] }
   If not a timetable, return null.

JSON Schema:
{
  "title": "string",
  "category": "one of the 16 categories",
  "description": "string",
  "tracks_completion": true or false,
  "expires_at": "YYYY-MM-DD or null",
  "target_departments": ["CSE"] or null,
  "target_semesters": [1, 2] or null,
  "target_sections": ["A"] or null,
  "candidate_events": [
    {
      "title": "string",
      "event_type": "exam | assignment_deadline | registration_deadline | admission_deadline | scholarship_deadline | semester_start | semester_end | holiday | class_event | other",
      "starts_at": "YYYY-MM-DD",
      "ends_at": "YYYY-MM-DD or null",
      "all_day": true
    }
  ],
  "candidate_timetable": null
}`
        },
        { role: 'user', content: rawText }
      ],
      response_format: { type: 'json_object' }
    })

    const extractedContent = completion.choices[0]?.message?.content
    if (!extractedContent) {
      throw new Error('Failed to extract metadata from AI model')
    }

    const parsed = JSON.parse(extractedContent)

    // Normalize category
    const category: DocumentCategory = ALL_DOCUMENT_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'notice'

    const { target_departments, target_semesters, target_sections } = normalizeAudience(
      parsed.target_departments,
      parsed.target_semesters,
      parsed.target_sections
    )

    const candidate_events: CandidateEvent[] = Array.isArray(parsed.candidate_events)
      ? parsed.candidate_events.map((ev: Record<string, unknown>) => ({
          title: String(ev.title || parsed.title),
          description: ev.description ? String(ev.description) : null,
          event_type: (ev.event_type as AcademicEventType) || 'other',
          starts_at: String(ev.starts_at || new Date().toISOString()),
          ends_at: ev.ends_at ? String(ev.ends_at) : null,
          all_day: Boolean(ev.all_day ?? true),
        }))
      : []

    return {
      success: true,
      data: {
        title: parsed.title || file.name.replace(/\.pdf$/i, ''),
        description: parsed.description || '',
        category,
        tracks_completion: Boolean(parsed.tracks_completion),
        target_departments,
        target_semesters,
        target_sections,
        expires_at: parsed.expires_at || null,
        candidate_events,
        candidate_timetable: parsed.candidate_timetable || null,
        rawText,
        storagePath: fileName,
        storageBucket: INSTITUTIONAL_BUCKET,
        fileSize: file.size,
        signedUrl,
      }
    }
  } catch (error: unknown) {
    console.error('Error in parsePDF:', error)
    // Ingestion failure: clean up storage file if it was created
    if (uploadedStoragePath) {
      try {
        const auth = await verifyAdminAction()
        if (auth.supabase) {
          await auth.supabase.storage.from(INSTITUTIONAL_BUCKET).remove([uploadedStoragePath])
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup temporary storage file:', cleanupErr)
      }
    }
    return { success: false, error: getErrorMessage(error) }
  }
}

function chunkText(text: string, maxWords: number = 300): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

export type PublishDocumentPayload = {
  title: string
  description: string
  category: DocumentCategory
  tracks_completion: boolean
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  expires_at?: string | null
  storagePath: string
  storageBucket: string
  fileSize: number
  rawText: string
  candidate_events?: CandidateEvent[]
  candidate_timetable?: CandidateTimetable | null
  isDraft?: boolean
}

export async function publishDocument(payload: PublishDocumentPayload) {
  let createdDocumentId: string | null = null

  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized || !auth.admin) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase
    const status = payload.isDraft ? 'draft' : 'published'
    const publishedAt = payload.isDraft ? null : new Date().toISOString()

    // 1. Insert into public.documents
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        status,
        tracks_completion: payload.tracks_completion,
        target_departments: payload.target_departments,
        target_semesters: payload.target_semesters,
        target_sections: payload.target_sections,
        expires_at: payload.expires_at || null,
        storage_bucket: payload.storageBucket || INSTITUTIONAL_BUCKET,
        storage_path: payload.storagePath,
        mime_type: 'application/pdf',
        file_size: payload.fileSize,
        uploaded_by: auth.admin.id,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (docError || !docData) {
      throw new Error(`Document insert failed: ${docError?.message}`)
    }

    createdDocumentId = docData.id

    // 2. Chunk text and generate vector embeddings
    const rawChunks = chunkText(payload.rawText, 300)
    const header = `[Document: ${payload.title} | Category: ${payload.category} | Departments: ${payload.target_departments ? payload.target_departments.join(',') : 'All'} | Semesters: ${payload.target_semesters ? payload.target_semesters.join(',') : 'All'}]`

    const enrichedChunks = rawChunks.map((chunk, idx) => ({
      chunk_index: idx,
      content: `${header}\n${chunk}`,
      page_number: null,
    }))

    const chunkRows = []
    for (const chunk of enrichedChunks) {
      const embedding = await generateEmbedding(chunk.content)
      chunkRows.push({
        document_id: createdDocumentId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        embedding,
        page_number: chunk.page_number,
      })
    }

    if (chunkRows.length > 0) {
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(chunkRows)

      if (chunkError) {
        throw new Error(`Failed to insert document chunks: ${chunkError.message}`)
      }
    }

    // 3. Insert structured academic events if provided
    if (payload.candidate_events && payload.candidate_events.length > 0) {
      const eventRows = payload.candidate_events.map(ev => ({
        source_document_id: createdDocumentId,
        title: ev.title,
        description: ev.description || null,
        event_type: ev.event_type,
        starts_at: ev.starts_at,
        ends_at: ev.ends_at || null,
        all_day: Boolean(ev.all_day),
        target_departments: payload.target_departments,
        target_semesters: payload.target_semesters,
        target_sections: payload.target_sections,
      }))

      const { error: eventsError } = await supabase
        .from('academic_events')
        .insert(eventRows)

      if (eventsError) {
        console.warn('Warning: Failed to insert candidate academic events:', eventsError.message)
      }
    }

    // 4. Insert structured timetable if provided
    if (payload.candidate_timetable && payload.candidate_timetable.entries.length > 0) {
      const { data: timetableData, error: timetableError } = await supabase
        .from('timetables')
        .insert({
          source_document_id: createdDocumentId,
          name: payload.candidate_timetable.name,
          target_departments: payload.target_departments,
          target_semesters: payload.target_semesters,
          target_sections: payload.target_sections,
          valid_from: payload.candidate_timetable.valid_from,
          valid_until: payload.candidate_timetable.valid_until || null,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (!timetableError && timetableData) {
        const entryRows = payload.candidate_timetable.entries.map(entry => ({
          timetable_id: timetableData.id,
          day_of_week: entry.day_of_week,
          start_time: entry.start_time,
          end_time: entry.end_time,
          subject: entry.subject,
          room: entry.room || null,
          instructor: entry.instructor || null,
        }))

        await supabase.from('timetable_entries').insert(entryRows)
      }
    }

    return { success: true, documentId: createdDocumentId }
  } catch (error: unknown) {
    console.error('Error in publishDocument:', error)
    // Clean up created document if it failed halfway
    if (createdDocumentId) {
      try {
        const auth = await verifyAdminAction()
        if (auth.supabase) {
          await auth.supabase.from('documents').delete().eq('id', createdDocumentId)
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup partial document record:', cleanupErr)
      }
    }
    return { success: false, error: getErrorMessage(error) }
  }
}

export type UpdateDocumentPayload = {
  id: string
  title: string
  description?: string | null
  category: DocumentCategory
  tracks_completion: boolean
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  expires_at?: string | null
  status?: 'published' | 'draft' | 'archived'
}

export async function updateDocument(payload: UpdateDocumentPayload) {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    const updatePayload: Record<string, unknown> = {
      title: payload.title,
      description: payload.description || null,
      category: payload.category,
      tracks_completion: payload.tracks_completion,
      target_departments: payload.target_departments,
      target_semesters: payload.target_semesters,
      target_sections: payload.target_sections,
      expires_at: payload.expires_at || null,
      updated_at: new Date().toISOString(),
    }

    if (payload.status) {
      updatePayload.status = payload.status
      if (payload.status === 'published') {
        updatePayload.published_at = new Date().toISOString()
      }
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', payload.id)

    if (updateError) throw new Error(updateError.message)

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
    const status = action === 'publish' || action === 'restore' ? 'published' : action === 'draft' ? 'draft' : 'archived'

    const { error } = await supabase
      .from('documents')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(error.message)

    return { success: true }
  } catch (error: unknown) {
    console.error('Error toggling lifecycle status:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

/**
 * Executes canonical Section 20 institutional document hard deletion:
 * 1. Find historical message_sources referencing document -> set document_id = NULL (preserve source_title)
 * 2. Find document_completions referencing document -> set document_id = NULL (preserve document_title)
 * 3. Delete document row (cascades to document_chunks, academic_events, timetables, timetable_entries)
 * 4. Remove physical PDF file from private Storage bucket
 */
export async function deletePublishedDocument(id: string, storagePathOrUrl: string) {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase

    // 1. Disassociate message sources
    await supabase
      .from('message_sources')
      .update({ document_id: null })
      .eq('document_id', id)

    // 2. Disassociate document completions
    await supabase
      .from('document_completions')
      .update({ document_id: null })
      .eq('document_id', id)

    // 3. Delete document from database (cascades chunks, events, timetables)
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (dbError) throw new Error(`Database delete failed: ${dbError.message}`)

    // 4. Delete storage file separately
    const storagePath = extractStoragePath(storagePathOrUrl, INSTITUTIONAL_BUCKET)
    if (storagePath) {
      await supabase.storage
        .from(INSTITUTIONAL_BUCKET)
        .remove([storagePath])
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
