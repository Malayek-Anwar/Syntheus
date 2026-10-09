import 'server-only'

import { z } from 'zod'
import { ALL_DEPARTMENTS } from '@/utils/audience'
import { INSTITUTION_TIME_ZONE_OFFSET } from '@/utils/constants'

const categories = [
  'notice', 'circular', 'schedule', 'calendar', 'syllabus', 'form',
  'admission', 'registration', 'scholarship', 'placement', 'fees',
  'notes', 'reference_material', 'question_paper', 'question_bank', 'assignment',
] as const

const eventTypes = [
  'exam', 'assignment_deadline', 'registration_deadline',
  'admission_deadline', 'scholarship_deadline', 'semester_start',
  'semester_end', 'holiday', 'class_event', 'other',
] as const

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
}, 'Expected a valid YYYY-MM-DD date')

const dateTime = z.string().refine((value) => {
  if (date.safeParse(value).success) return true

  const timestamp = value.match(
    /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/,
  )
  return Boolean(timestamp && date.safeParse(timestamp[1]).success) &&
    !Number.isNaN(Date.parse(value))
}, 'Expected a valid date or timezone-qualified ISO timestamp')

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)

const seconds = (value: string) => {
  const [hours, minutes, secs = '0'] = value.split(':')
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(secs)
}

const normalizeDateTime = (value: string) =>
  date.safeParse(value).success
    ? new Date(`${value}T00:00:00.000${INSTITUTION_TIME_ZONE_OFFSET}`).toISOString()
    : new Date(value).toISOString()

const normalizeExpiryDateTime = (value: string) =>
  date.safeParse(value).success
    ? new Date(`${value}T23:59:59.999${INSTITUTION_TIME_ZONE_OFFSET}`).toISOString()
    : new Date(value).toISOString()

const event = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  event_type: z.enum(eventTypes),
  starts_at: dateTime,
  ends_at: dateTime.nullable().optional(),
  all_day: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (
    value.ends_at &&
    Date.parse(normalizeDateTime(value.ends_at)) <
      Date.parse(normalizeDateTime(value.starts_at))
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['ends_at'],
      message: 'Event end precedes its start',
    })
  }
})

const entry = z.object({
  day_of_week: z.number().int().min(1).max(7),
  start_time: time,
  end_time: time,
  subject: z.string().trim().min(1).max(200),
  room: z.string().trim().max(100).nullable().optional(),
  instructor: z.string().trim().max(200).nullable().optional(),
}).superRefine((value, ctx) => {
  if (seconds(value.end_time) <= seconds(value.start_time)) {
    ctx.addIssue({
      code: 'custom',
      path: ['end_time'],
      message: 'Timetable end must be after start',
    })
  }
})

const timetable = z.object({
  name: z.string().trim().min(1).max(200),
  valid_from: date,
  valid_until: date.nullable().optional(),
  entries: z.array(entry).min(1).max(500),
}).superRefine((value, ctx) => {
  if (value.valid_until && value.valid_until < value.valid_from) {
    ctx.addIssue({
      code: 'custom',
      path: ['valid_until'],
      message: 'Timetable end precedes start',
    })
  }
})

const targetText = z.union([
  z.string(),
  z.array(z.string()),
  z.null(),
]).optional()

const targetSemesters = z.union([
  z.string(),
  z.number(),
  z.array(z.union([z.string(), z.number()])),
  z.null(),
]).optional()

const metadata = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  category: z.enum(categories),
  tracks_completion: z.boolean(),
  expires_at: dateTime.nullable().optional(),
  target_departments: targetText,
  target_semesters: targetSemesters,
  target_sections: targetText,
  candidate_events: z.array(event).max(200).default([]),
  candidate_timetable: timetable.nullable().optional().default(null),
})

const publish = z.object({
  documentId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.enum(categories),
  tracks_completion: z.boolean(),
  target_departments: z.array(z.enum(ALL_DEPARTMENTS)).min(1).max(5).nullable(),
  target_semesters: z.array(z.number().int().min(1).max(8)).min(1).max(8).nullable(),
  target_sections: z.array(z.string().trim().min(1).max(10)).min(1).max(30).nullable(),
  expires_at: dateTime.nullable().optional(),
  candidate_events: z.array(event).max(200).optional().default([]),
  candidate_timetable: timetable.nullable().optional().default(null),
  isDraft: z.boolean().optional().default(false),
})

function normalize<
  T extends {
    starts_at: string
    ends_at?: string | null
    description?: string | null
  },
>(value: T) {
  return {
    ...value,
    starts_at: normalizeDateTime(value.starts_at),
    ends_at: value.ends_at ? normalizeDateTime(value.ends_at) : null,
    description: value.description ?? null,
  }
}

export function parseAiInstitutionalMetadata(input: unknown) {
  const value = metadata.parse(input)

  return {
    ...value,
    expires_at: value.expires_at
      ? normalizeExpiryDateTime(value.expires_at)
      : null,
    candidate_events: value.candidate_events.map(normalize),
    candidate_timetable: value.candidate_timetable
      ? {
          ...value.candidate_timetable,
          valid_until: value.candidate_timetable.valid_until ?? null,
          entries: value.candidate_timetable.entries.map((item) => ({
            ...item,
            room: item.room ?? null,
            instructor: item.instructor ?? null,
          })),
        }
      : null,
  }
}

export function parsePublishDocumentPayload(input: unknown) {
  const value = publish.parse(input)

  return {
    ...value,
    target_sections: value.target_sections?.map((section) =>
      section.toUpperCase(),
    ) ?? null,
    description: value.description ?? '',
    expires_at: value.expires_at
      ? normalizeExpiryDateTime(value.expires_at)
      : null,
    candidate_events: value.candidate_events.map(normalize),
    candidate_timetable: value.candidate_timetable
      ? {
          ...value.candidate_timetable,
          valid_until: value.candidate_timetable.valid_until ?? null,
          entries: value.candidate_timetable.entries.map((item) => ({
            ...item,
            room: item.room ?? null,
            instructor: item.instructor ?? null,
          })),
        }
      : null,
  }
}
