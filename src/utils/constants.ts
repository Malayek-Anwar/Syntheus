import type { DocumentCategory, InstituteCategory, StudyCategory, AcademicEventType } from '@/types/database'

export const INSTITUTE_CATEGORIES: InstituteCategory[] = [
  'notice',
  'circular',
  'schedule',
  'calendar',
  'syllabus',
  'form',
  'admission',
  'registration',
  'scholarship',
  'placement',
  'fees',
]

export const STUDY_CATEGORIES: StudyCategory[] = [
  'notes',
  'reference_material',
  'question_paper',
  'question_bank',
  'assignment',
]

export const ALL_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  ...INSTITUTE_CATEGORIES,
  ...STUDY_CATEGORIES,
]

export const CATEGORY_META: Record<DocumentCategory, { label: string; group: 'institute' | 'study'; icon: string }> = {
  // Institute
  notice: { label: 'Notice', group: 'institute', icon: '📢' },
  circular: { label: 'Circular', group: 'institute', icon: '📜' },
  schedule: { label: 'Schedule', group: 'institute', icon: '⏱️' },
  calendar: { label: 'Academic Calendar', group: 'institute', icon: '📅' },
  syllabus: { label: 'Syllabus', group: 'institute', icon: '📖' },
  form: { label: 'Form', group: 'institute', icon: '📝' },
  admission: { label: 'Admission', group: 'institute', icon: '🎓' },
  registration: { label: 'Registration', group: 'institute', icon: '✍️' },
  scholarship: { label: 'Scholarship', group: 'institute', icon: '🏆' },
  placement: { label: 'Placement', group: 'institute', icon: '💼' },
  fees: { label: 'Fees & Dues', group: 'institute', icon: '💳' },
  // Study
  notes: { label: 'Lecture Notes', group: 'study', icon: '📓' },
  reference_material: { label: 'Reference Material', group: 'study', icon: '📚' },
  question_paper: { label: 'Question Paper', group: 'study', icon: '📄' },
  question_bank: { label: 'Question Bank', group: 'study', icon: '🗂️' },
  assignment: { label: 'Assignment', group: 'study', icon: '📋' },
}

export const ACADEMIC_EVENT_TYPES: AcademicEventType[] = [
  'exam',
  'assignment_deadline',
  'registration_deadline',
  'admission_deadline',
  'scholarship_deadline',
  'semester_start',
  'semester_end',
  'holiday',
  'class_event',
  'other',
]

export const EVENT_TYPE_META: Record<AcademicEventType, { label: string; icon: string }> = {
  exam: { label: 'Exam', icon: '📝' },
  assignment_deadline: { label: 'Assignment Deadline', icon: '⏰' },
  registration_deadline: { label: 'Registration Deadline', icon: '✍️' },
  admission_deadline: { label: 'Admission Deadline', icon: '🎓' },
  scholarship_deadline: { label: 'Scholarship Deadline', icon: '🏆' },
  semester_start: { label: 'Semester Start', icon: '🚀' },
  semester_end: { label: 'Semester End', icon: '🏁' },
  holiday: { label: 'Holiday', icon: '🎉' },
  class_event: { label: 'Class Event', icon: '🏫' },
  other: { label: 'Academic Event', icon: '📌' },
}

export type SuggestionPrompt = {
  label: string
  query: string
  description?: string
}

export type SuggestionContext = {
  department?: string | null
  semester?: number | string | null
  personalDocuments?: Array<{ title: string }>
  upcomingEvents?: Array<{
    title: string
    event_type?: string | null
    starts_at?: string | null
  }>
}

export function generatePersonalizedSuggestions(ctx?: SuggestionContext): SuggestionPrompt[] {
  const dept = ctx?.department || 'CSE'
  const sem = ctx?.semester
    ? (typeof ctx.semester === 'string' && ctx.semester.toLowerCase().includes('semester')
        ? ctx.semester.replace(/semester\s*/i, 'Sem ')
        : `Sem ${ctx.semester}`)
    : 'Sem 1'

  const suggestions: SuggestionPrompt[] = []

  // 1. Personal documents prioritization
  if (ctx?.personalDocuments && ctx.personalDocuments.length > 0) {
    for (const doc of ctx.personalDocuments.slice(0, 2)) {
      const cleanTitle = doc.title.replace(/\.pdf$/i, '').trim()
      const shortTitle = cleanTitle.length > 18 ? cleanTitle.slice(0, 16) + '...' : cleanTitle
      suggestions.push({
        label: `📄 ${shortTitle}`,
        query: `What are the important details and clauses in my uploaded document "${cleanTitle}"?`,
        description: `Query your private file: ${shortTitle}`,
      })
    }
  }

  // 2. Upcoming events prioritization
  if (ctx?.upcomingEvents && ctx.upcomingEvents.length > 0) {
    const event = ctx.upcomingEvents[0]
    const cleanTitle = event.title.replace(/\.pdf$/i, '').trim()
    const shortTitle = cleanTitle.length > 18 ? cleanTitle.slice(0, 16) + '...' : cleanTitle
    suggestions.push({
      label: `⏳ ${shortTitle}`,
      query: `What are the details and key dates for "${cleanTitle}"?`,
      description: `Check upcoming event details`,
    })
  }

  // 3. Department & Semester specific academic schedule / lab suggestions
  suggestions.push({
    label: `🔬 ${dept} ${sem} Labs`,
    query: `Show ${dept} ${sem} lab schedule and practical timetable`,
    description: `${dept} lab practicals & timings`,
  })

  suggestions.push({
    label: `📅 ${dept} ${sem} Exams`,
    query: `When are the mid-sem and end-sem exams for ${dept} ${sem}?`,
    description: `Exam schedule & syllabus updates`,
  })

  // 4. Fallback circulars
  if (suggestions.length < 4) {
    suggestions.push({
      label: `💳 ${sem} Fees`,
      query: `Are there any fee payment or registration deadlines for ${sem}?`,
      description: `Tuition dues and registration`,
    })
  }

  if (suggestions.length < 4) {
    suggestions.push({
      label: `📢 ${dept} Circulars`,
      query: `What are the latest announcements and circulars for ${dept} students?`,
      description: `Official department notices`,
    })
  }

  const seenQueries = new Set<string>()
  const finalPrompts: SuggestionPrompt[] = []
  for (const s of suggestions) {
    if (!seenQueries.has(s.query)) {
      seenQueries.add(s.query)
      finalPrompts.push(s)
    }
    if (finalPrompts.length === 4) break
  }

  return finalPrompts
}

export const SUGGESTED_PROMPTS: SuggestionPrompt[] = generatePersonalizedSuggestions()
