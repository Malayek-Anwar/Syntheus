import type { AcademicEventType, DocumentCategory } from '@/types/database'

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

export type InstitutionalMetadataSuggestions = {
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
}
