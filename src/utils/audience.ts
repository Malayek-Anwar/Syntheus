export const ALL_DEPARTMENTS = ['CSE', 'ECE', 'ME', 'CE', 'IT'] as const
export type Department = typeof ALL_DEPARTMENTS[number]

export const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export const ODD_SEMESTERS = [1, 3, 5, 7] as const
export const EVEN_SEMESTERS = [2, 4, 6, 8] as const

const DEPT_ALIASES: Record<string, string> = {
  'computer science': 'CSE',
  'cse': 'CSE',
  'computer science & engineering': 'CSE',
  'computer science and engineering': 'CSE',
  'electrical engineering': 'ECE',
  'electronics': 'ECE',
  'ece': 'ECE',
  'electronics & communication': 'ECE',
  'electronics and communication': 'ECE',
  'mechanical engineering': 'ME',
  'mechanical': 'ME',
  'me': 'ME',
  'civil engineering': 'CE',
  'civil': 'CE',
  'ce': 'CE',
  'information technology': 'IT',
  'it': 'IT',
}

export type StudentProfileTarget = {
  department: string | null
  semester: number | null
  section: string | null
}

export type DocumentTarget = {
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
}

export function normalizeSection(section?: string | null): string | null {
  if (!section) return null
  const trimmed = section.trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeAudience(
  extractedDept?: string | string[] | null,
  extractedSem?: string | number | (string | number)[] | null,
  extractedSec?: string | string[] | null
): {
  target_departments: string[] | null
  target_semesters: number[] | null
  target_sections: string[] | null
} {
  // 1. Normalize Departments: NULL means All
  let target_departments: string[] | null = null

  if (extractedDept) {
    if (Array.isArray(extractedDept)) {
      const isAll = extractedDept.some(d => String(d).trim().toLowerCase() === 'all')
      if (!isAll) {
        const depts = extractedDept
          .map(d => {
            const key = String(d).trim().toLowerCase()
            return DEPT_ALIASES[key] || String(d).trim().toUpperCase()
          })
          .filter(Boolean)
        if (depts.length > 0) {
          target_departments = Array.from(new Set(depts))
        }
      }
    } else {
      const deptStr = String(extractedDept).trim()
      if (deptStr.toLowerCase() !== 'all') {
        const depts = deptStr
          .split(',')
          .map(d => {
            const key = d.trim().toLowerCase()
            return DEPT_ALIASES[key] || d.trim().toUpperCase()
          })
          .filter(Boolean)
        if (depts.length > 0) {
          target_departments = Array.from(new Set(depts))
        }
      }
    }
  }

  // 2. Normalize Semesters: NULL means All
  let target_semesters: number[] | null = null

  if (extractedSem !== undefined && extractedSem !== null && extractedSem !== '') {
    if (Array.isArray(extractedSem)) {
      const semStrings = extractedSem.map(s => String(s).trim().toLowerCase())
      if (semStrings.includes('odd')) {
        target_semesters = [...ODD_SEMESTERS]
      } else if (semStrings.includes('even')) {
        target_semesters = [...EVEN_SEMESTERS]
      } else if (!semStrings.includes('all')) {
        const nums = extractedSem
          .map(s => parseInt(String(s).replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= 8)
        if (nums.length > 0) {
          target_semesters = Array.from(new Set(nums)).sort((a, b) => a - b)
        }
      }
    } else {
      const semStr = String(extractedSem).trim().toLowerCase()
      if (semStr === 'odd') {
        target_semesters = [...ODD_SEMESTERS]
      } else if (semStr === 'even') {
        target_semesters = [...EVEN_SEMESTERS]
      } else if (semStr !== 'all') {
        const nums = semStr
          .split(',')
          .map(s => parseInt(s.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= 8)
        if (nums.length > 0) {
          target_semesters = Array.from(new Set(nums)).sort((a, b) => a - b)
        }
      }
    }
  }

  // 3. Normalize Sections: NULL means All
  let target_sections: string[] | null = null

  if (extractedSec) {
    if (Array.isArray(extractedSec)) {
      const isAll = extractedSec.some(s => String(s).trim().toLowerCase() === 'all')
      if (!isAll) {
        const secs = extractedSec
          .map(s => normalizeSection(s))
          .filter((s): s is string => Boolean(s))
        if (secs.length > 0) {
          target_sections = Array.from(new Set(secs))
        }
      }
    } else {
      const secStr = String(extractedSec).trim()
      if (secStr.toLowerCase() !== 'all') {
        const secs = secStr
          .split(',')
          .map(s => normalizeSection(s))
          .filter((s): s is string => Boolean(s))
        if (secs.length > 0) {
          target_sections = Array.from(new Set(secs))
        }
      }
    }
  }

  return { target_departments, target_semesters, target_sections }
}

/**
 * Determines whether a document or event is visible to a student.
 *
 * Locked V1 Targeting Rules:
 * - Document NULL = All for that dimension.
 * - Array values = OR alternatives within the dimension.
 * - Dimensions combine with AND.
 * - CRITICAL: Student NULL does NOT mean "all". A student's missing or NULL profile value
 *   does not match a targeted document, preventing incomplete profiles from bypassing targeting.
 * - The only exception is section when both student.section is NULL and document.target_sections is NULL
 *   (i.e. no section distinction).
 */
export function isDocumentVisibleToStudent(
  doc: DocumentTarget,
  student: StudentProfileTarget
): boolean {
  // 1. Department dimension check
  if (doc.target_departments !== null && doc.target_departments.length > 0) {
    if (!student.department) return false
    const matchDept = doc.target_departments.some(
      d => d.toUpperCase() === student.department?.toUpperCase()
    )
    if (!matchDept) return false
  }

  // 2. Semester dimension check
  if (doc.target_semesters !== null && doc.target_semesters.length > 0) {
    if (student.semester === null || student.semester === undefined) return false
    const matchSem = doc.target_semesters.includes(student.semester)
    if (!matchSem) return false
  }

  // 3. Section dimension check
  if (doc.target_sections !== null && doc.target_sections.length > 0) {
    if (!student.section) return false
    const normalizedStudSec = student.section.toUpperCase()
    const matchSec = doc.target_sections.some(s => s.toUpperCase() === normalizedStudSec)
    if (!matchSec) return false
  }

  return true
}

// Backward-compatible alias for existing components
export function isAudienceVisibleToStudent(
  doc: {
    target_departments?: string[] | null
    target_semesters?: number[] | null
    target_sections?: string[] | null
  },
  studentDept: string | null,
  studentSem: number | null,
  studentSec: string | null = null
): boolean {
  return isDocumentVisibleToStudent(
    {
      target_departments: doc.target_departments ?? null,
      target_semesters: doc.target_semesters ?? null,
      target_sections: doc.target_sections ?? null,
    },
    {
      department: studentDept,
      semester: studentSem,
      section: studentSec,
    }
  )
}
