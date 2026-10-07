export type AccountStatus = 'pending' | 'active' | 'suspended'

export type DocumentStatus = 'draft' | 'processing' | 'published' | 'archived'

export type InstituteCategory =
  | 'notice'
  | 'circular'
  | 'schedule'
  | 'calendar'
  | 'syllabus'
  | 'form'
  | 'admission'
  | 'registration'
  | 'scholarship'
  | 'placement'
  | 'fees'

export type StudyCategory =
  | 'notes'
  | 'reference_material'
  | 'question_paper'
  | 'question_bank'
  | 'assignment'

export type DocumentCategory = InstituteCategory | StudyCategory

export type PersonalDocumentStatus = 'processing' | 'ready'

export type ChatMessageRole = 'user' | 'assistant'

export type AcademicEventType =
  | 'exam'
  | 'assignment_deadline'
  | 'registration_deadline'
  | 'admission_deadline'
  | 'scholarship_deadline'
  | 'semester_start'
  | 'semester_end'
  | 'holiday'
  | 'class_event'
  | 'other'

// 1. app_users
export interface AppUser {
  id: string // FK -> auth.users.id
  created_at: string
  updated_at: string
}

// 2. students
export interface Student {
  id: string // FK -> app_users.id
  roll_number: string | null
  account_status: AccountStatus
  institutional_name: string | null
  display_name: string | null
  department: string | null
  semester: number | null // 1 - 8
  section: string | null // Uppercase
  created_at: string
  updated_at: string
}

// 3. admins
export interface Admin {
  id: string // FK -> app_users.id
  name: string
  position: string
  department: string | null
  created_at: string
  updated_at: string
}

// 4. documents
export interface Document {
  id: string
  title: string
  description: string | null
  category: DocumentCategory
  status: DocumentStatus
  tracks_completion: boolean
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  expires_at: string | null
  storage_bucket: string
  storage_path: string
  mime_type: string
  file_size: number
  uploaded_by: string // FK -> admins.id
  published_at: string | null
  created_at: string
  updated_at: string
}

// 5. document_chunks
export interface DocumentChunk {
  id: string
  document_id: string // FK -> documents.id
  chunk_index: number
  content: string
  embedding: number[] // 384 dimensions
  search_vector?: unknown
  page_number: number | null
  created_at: string
}

// 6. personal_documents
export interface PersonalDocument {
  id: string
  student_id: string // FK -> students.id
  title: string
  description: string | null
  status: PersonalDocumentStatus
  storage_bucket: string
  storage_path: string
  mime_type: string
  file_size: number
  created_at: string
  updated_at: string
}

// 7. personal_document_chunks
export interface PersonalDocumentChunk {
  id: string
  personal_document_id: string // FK -> personal_documents.id
  chunk_index: number
  content: string
  embedding: number[] // 384 dimensions
  search_vector?: unknown
  page_number: number | null
  created_at: string
}

// 8. chat_conversations
export interface ChatConversation {
  id: string
  student_id: string // FK -> students.id
  title: string
  created_at: string
  updated_at: string
}

// 9. chat_messages
export interface ChatMessage {
  id: string
  conversation_id: string // FK -> chat_conversations.id
  role: ChatMessageRole
  content: string
  created_at: string
}

// 10. message_sources
export interface MessageSource {
  id: string
  message_id: string // FK -> chat_messages.id
  document_id: string | null // FK -> documents.id
  personal_document_id: string | null // FK -> personal_documents.id
  source_title: string
  created_at: string
}

// 11. document_completions
export interface DocumentCompletion {
  id: string
  student_id: string // FK -> students.id
  document_id: string | null // FK -> documents.id
  document_title: string
  completed_at: string
  verified_by: string | null // FK -> app_users.id
  verified_at: string | null
  updated_at: string
}

// 12. academic_events
export interface AcademicEvent {
  id: string
  title: string
  description: string | null
  event_type: AcademicEventType
  starts_at: string
  ends_at: string | null
  all_day: boolean
  source_document_id: string // FK -> documents.id
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  created_at: string
}

// 13. timetables
export interface Timetable {
  id: string
  name: string
  source_document_id: string // FK -> documents.id
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
  valid_from: string // YYYY-MM-DD
  valid_until: string | null // YYYY-MM-DD
  created_at: string
  updated_at: string
}

// 14. timetable_entries
export interface TimetableEntry {
  id: string
  timetable_id: string // FK -> timetables.id
  day_of_week: number // 1 - 7 (Monday = 1, Sunday = 7)
  start_time: string // HH:MM:SS
  end_time: string // HH:MM:SS
  subject: string
  room: string | null
  instructor: string | null
  created_at: string
}
