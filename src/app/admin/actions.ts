'use server'

import { verifyAdminAction } from '@/utils/auth'
import { normalizeAudience } from '@/utils/audience'
import { getErrorMessage } from '@/utils/errors'
import { ingestInstitutionalDocument } from '@/lib/documents/ingest-institutional-document'
import { validatePdfUpload } from '@/lib/documents/validate-pdf-upload'
import {
  parseAiInstitutionalMetadata,
  parsePublishDocumentPayload,
} from '@/lib/documents/validate-institutional-metadata'
import type {
  CandidateEvent,
  CandidateTimetable,
} from '@/lib/documents/institutional-types'
export type { CandidateEvent, CandidateTimetable } from '@/lib/documents/institutional-types'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import {
  INSTITUTIONAL_BUCKET,
  getInstitutionalSignedUrl,
  SIGNED_URL_TTL_SECONDS,
} from '@/utils/storage'
import type { DocumentCategory } from '@/types/database'
import { ALL_DOCUMENT_CATEGORIES } from '@/utils/constants'

export type ExtractedData = {
  documentId: string
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
  signedUrl: string
}

export async function parsePDF(formData: FormData): Promise<{ success: boolean; data?: ExtractedData; error?: string }> {
  let uploadedStoragePath: string | null = null
  let processingDocumentId: string | null = null
  let documentSupabase: Awaited<ReturnType<typeof verifyAdminAction>>['supabase'] | null = null

  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized || !auth.admin) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const file = formData.get('file')
    const { file: pdfFile, buffer, text: rawText } = await validatePdfUpload(file)

    const supabase = auth.supabase
    documentSupabase = supabase

    const fileName = `${uuidv4()}.pdf`
    uploadedStoragePath = fileName
    const initialTitle = pdfFile.name.replace(/\.pdf$/i, '').trim() || 'Untitled institutional document'

    // Keep the document in processing until an administrator reviews its suggestions.
    const { data: processingDocument, error: documentError } = await supabase
      .from('documents')
      .insert({
        title: initialTitle,
        category: 'notice',
        status: 'processing',
        storage_bucket: INSTITUTIONAL_BUCKET,
        storage_path: fileName,
        mime_type: 'application/pdf',
        file_size: pdfFile.size,
        uploaded_by: auth.admin.id,
        updated_at: new Date().toISOString(),
      })
      .select('id, title, storage_bucket, storage_path, uploaded_by')
      .single()

    if (documentError || !processingDocument) {
      throw new Error(`Failed to create processing document: ${documentError?.message ?? 'No document returned'}`)
    }
    processingDocumentId = processingDocument.id

    // The source is bound to the processing row before server-side extraction begins.
    const { error: uploadError } = await supabase
      .storage
      .from(INSTITUTIONAL_BUCKET)
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const signedUrl = await getInstitutionalSignedUrl(supabase, fileName, SIGNED_URL_TTL_SECONDS)
    if (!signedUrl) {
      throw new Error('Failed to generate preview signed URL for uploaded PDF')
    }

    // 2. Ingest only text extracted by server-side PDF parsing.
    await ingestInstitutionalDocument(processingDocument, auth.admin.id, rawText)

    // AI output remains suggestions for administrator review; it is not persisted here.
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is required to suggest institutional metadata')
    }
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

    const parsed = parseAiInstitutionalMetadata(
      JSON.parse(extractedContent),
    )

    const {
      target_departments,
      target_semesters,
      target_sections,
    } = normalizeAudience(
      parsed.target_departments,
      parsed.target_semesters,
      parsed.target_sections,
    )

    return {
      success: true,
      data: {
        documentId: processingDocument.id,
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        tracks_completion: parsed.tracks_completion,
        target_departments,
        target_semesters,
        target_sections,
        expires_at: parsed.expires_at,
        candidate_events: parsed.candidate_events as CandidateEvent[],
        candidate_timetable: parsed.candidate_timetable as CandidateTimetable | null,
        signedUrl,
      }
    }
  } catch (error: unknown) {
    console.error('Error in parsePDF:', error)
    const cleanupErrors: string[] = []
    if (processingDocumentId && documentSupabase) {
      const { error: deleteError } = await documentSupabase
        .from('documents')
        .delete()
        .eq('id', processingDocumentId)
      if (deleteError) cleanupErrors.push(`document cleanup failed: ${deleteError.message}`)
    }
    if (uploadedStoragePath) {
      try {
        const auth = await verifyAdminAction()
        if (!auth.authorized) throw new Error(auth.error || 'Admin authorization failed during cleanup')
        const { error: storageError } = await auth.supabase.storage
          .from(INSTITUTIONAL_BUCKET)
          .remove([uploadedStoragePath])
        if (storageError) cleanupErrors.push(`storage cleanup failed: ${storageError.message}`)
      } catch (cleanupErr) {
        cleanupErrors.push(`storage cleanup failed: ${getErrorMessage(cleanupErr)}`)
      }
    }
    const cleanupMessage = cleanupErrors.length > 0
      ? ` Cleanup also failed: ${cleanupErrors.join('; ')}`
      : ''
    return { success: false, error: `${getErrorMessage(error)}${cleanupMessage}` }
  }
}

export type PublishDocumentPayload = {
  documentId: string
  title: string
  description: string
  category: DocumentCategory
  tracks_completion: boolean
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  expires_at?: string | null
  candidate_events?: CandidateEvent[]
  candidate_timetable?: CandidateTimetable | null
  isDraft?: boolean
}

export async function publishDocument(payload: PublishDocumentPayload) {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized || !auth.admin) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    payload = parsePublishDocumentPayload(
      payload,
    ) as PublishDocumentPayload

    const supabase = auth.supabase
    if (!ALL_DOCUMENT_CATEGORIES.includes(payload.category)) {
      throw new Error('Invalid document category')
    }
    if (!payload.title.trim()) throw new Error('Document title is required')

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('id, status')
      .eq('id', payload.documentId)
      .eq('uploaded_by', auth.admin.id)
      .in('status', ['processing', 'draft'])
      .single()

    if (docError || !docData) {
      throw new Error(`Processing document not found or no longer editable: ${docError?.message ?? ''}`)
    }

    // Keep the document hidden until all administrator-approved structured data is saved.
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        title: payload.title,
        description: payload.description || null,
        category: payload.category,
        status: 'draft',
        tracks_completion: payload.tracks_completion,
        target_departments: payload.target_departments,
        target_semesters: payload.target_semesters,
        target_sections: payload.target_sections,
        expires_at: payload.expires_at || null,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.documentId)
      .eq('uploaded_by', auth.admin.id)
    if (updateError) throw new Error(`Failed to save reviewed metadata: ${updateError.message}`)

    // Replace structured suggestions on retries so a failed finalize remains safe to retry.
    const { error: existingEventsError } = await supabase
      .from('academic_events')
      .delete()
      .eq('source_document_id', payload.documentId)
    if (existingEventsError) throw new Error(`Failed to replace document events: ${existingEventsError.message}`)

    if (payload.candidate_events && payload.candidate_events.length > 0) {
      const eventRows = payload.candidate_events.map(ev => ({
        source_document_id: payload.documentId,
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

      if (eventsError) throw new Error(`Failed to save reviewed events: ${eventsError.message}`)
    }

    const { data: existingTimetables, error: existingTimetablesError } = await supabase
      .from('timetables')
      .select('id')
      .eq('source_document_id', payload.documentId)
    if (existingTimetablesError) {
      throw new Error(`Failed to replace document timetable: ${existingTimetablesError.message}`)
    }
    if (existingTimetables.length > 0) {
      const { error: deleteTimetablesError } = await supabase
        .from('timetables')
        .delete()
        .eq('source_document_id', payload.documentId)
      if (deleteTimetablesError) {
        throw new Error(`Failed to replace document timetable: ${deleteTimetablesError.message}`)
      }
    }

    if (payload.candidate_timetable && payload.candidate_timetable.entries.length > 0) {
      const { data: timetableData, error: timetableError } = await supabase
        .from('timetables')
        .insert({
          source_document_id: payload.documentId,
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

      if (timetableError || !timetableData) {
        throw new Error(`Failed to save reviewed timetable: ${timetableError?.message ?? 'No timetable returned'}`)
      }

      const entryRows = payload.candidate_timetable.entries.map(entry => ({
        timetable_id: timetableData.id,
        day_of_week: entry.day_of_week,
        start_time: entry.start_time,
        end_time: entry.end_time,
        subject: entry.subject,
        room: entry.room || null,
        instructor: entry.instructor || null,
      }))

      const { error: entriesError } = await supabase.from('timetable_entries').insert(entryRows)
      if (entriesError) throw new Error(`Failed to save reviewed timetable entries: ${entriesError.message}`)
    }

    if (!payload.isDraft) {
      const { error: publishError } = await supabase
        .from('documents')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.documentId)
        .eq('uploaded_by', auth.admin.id)
      if (publishError) throw new Error(`Failed to publish reviewed document: ${publishError.message}`)
    }

    return { success: true, documentId: payload.documentId }
  } catch (error: unknown) {
    console.error('Error in publishDocument:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}

export async function discardProcessingDocument(documentId: string) {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized || !auth.admin) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const { data: document, error: fetchError } = await auth.supabase
      .from('documents')
      .select('id, status, storage_bucket, storage_path')
      .eq('id', documentId)
      .eq('uploaded_by', auth.admin.id)
      .eq('status', 'processing')
      .single()
    if (fetchError || !document) {
      throw new Error(`Processing document not found: ${fetchError?.message ?? ''}`)
    }

    const { error: deleteError } = await auth.supabase
      .from('documents')
      .delete()
      .eq('id', document.id)
      .eq('uploaded_by', auth.admin.id)
    if (deleteError) throw new Error(`Failed to delete processing document: ${deleteError.message}`)

    const { error: storageError } = await auth.supabase.storage
      .from(document.storage_bucket)
      .remove([document.storage_path])
    if (storageError) {
      throw new Error(`Processing document was deleted, but its PDF cleanup failed: ${storageError.message}`)
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error discarding processing document:', error)
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
export async function deletePublishedDocument(id: string) {
  try {
    const auth = await verifyAdminAction()
    if (!auth.authorized) {
      return { success: false, error: auth.error || '403 Forbidden: Admin privileges required' }
    }

    const supabase = auth.supabase
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('id, storage_bucket, storage_path')
      .eq('id', id)
      .single()
    if (documentError || !document) {
      throw new Error(`Document not found: ${documentError?.message ?? ''}`)
    }
    if (document.storage_bucket !== INSTITUTIONAL_BUCKET) {
      throw new Error('Document uses an unexpected storage bucket')
    }

    // 1. Disassociate message sources
    const { error: sourcesError } = await supabase
      .from('message_sources')
      .update({ document_id: null })
      .eq('document_id', id)
    if (sourcesError) throw new Error(`Failed to preserve document citations: ${sourcesError.message}`)

    // 2. Disassociate document completions
    const { error: completionsError } = await supabase
      .from('document_completions')
      .update({ document_id: null })
      .eq('document_id', id)
    if (completionsError) throw new Error(`Failed to preserve document completions: ${completionsError.message}`)

    // 3. Delete document from database (cascades chunks, events, timetables)
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (dbError) throw new Error(`Database delete failed: ${dbError.message}`)

    // 4. Delete storage file separately
    const { error: storageError } = await supabase.storage
      .from(INSTITUTIONAL_BUCKET)
      .remove([document.storage_path])
    if (storageError) {
      throw new Error(`Document was deleted, but its PDF cleanup failed: ${storageError.message}`)
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting doc:', error)
    return { success: false, error: getErrorMessage(error) }
  }
}
