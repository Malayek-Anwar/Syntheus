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

export type NormalizedAudience = {
  target_departments: string[]
  target_semesters: number[]
}

/**
 * Normalizes audience keywords extracted by LLM into explicit array filters.
 *
 * Rules:
 * - If extractedDept is 'All' -> returns all college departments: ['CSE', 'ECE', 'ME', 'CE', 'IT']
 * - Otherwise -> returns [extractedDept] (or normalized department array)
 *
 * - If extractedSem is 'All' -> returns [1, 2, 3, 4, 5, 6, 7, 8]
 * - If extractedSem is 'Odd' -> returns [1, 3, 5, 7]
 * - If extractedSem is 'Even' -> returns [2, 4, 6, 8]
 * - Otherwise -> returns explicit integer semester array
 */
export function normalizeAudience(
  extractedDept?: string | string[] | null,
  extractedSem?: string | number | (string | number)[] | null
): NormalizedAudience {
  // 1. Normalize Departments
  let target_departments: string[] = []

  if (!extractedDept) {
    target_departments = [...ALL_DEPARTMENTS]
  } else if (Array.isArray(extractedDept)) {
    const isAll = extractedDept.some(d => String(d).trim().toLowerCase() === 'all')
    if (isAll) {
      target_departments = [...ALL_DEPARTMENTS]
    } else {
      const depts = extractedDept
        .map(d => {
          const key = String(d).trim().toLowerCase()
          return DEPT_ALIASES[key] || String(d).trim().toUpperCase()
        })
        .filter(Boolean)
      target_departments = depts.length > 0 ? Array.from(new Set(depts)) : [...ALL_DEPARTMENTS]
    }
  } else {
    const deptStr = String(extractedDept).trim()
    if (deptStr.toLowerCase() === 'all') {
      target_departments = [...ALL_DEPARTMENTS]
    } else if (deptStr.includes(',')) {
      const depts = deptStr
        .split(',')
        .map(d => {
          const key = d.trim().toLowerCase()
          return DEPT_ALIASES[key] || d.trim().toUpperCase()
        })
        .filter(Boolean)
      target_departments = depts.length > 0 ? Array.from(new Set(depts)) : [...ALL_DEPARTMENTS]
    } else {
      const normalized = DEPT_ALIASES[deptStr.toLowerCase()] || deptStr.toUpperCase()
      target_departments = [normalized]
    }
  }

  // 2. Normalize Semesters
  let target_semesters: number[] = []

  if (extractedSem === undefined || extractedSem === null || extractedSem === '') {
    target_semesters = [...ALL_SEMESTERS]
  } else if (Array.isArray(extractedSem)) {
    const semStrings = extractedSem.map(s => String(s).trim().toLowerCase())
    if (semStrings.includes('all')) {
      target_semesters = [...ALL_SEMESTERS]
    } else if (semStrings.includes('odd')) {
      target_semesters = [...ODD_SEMESTERS]
    } else if (semStrings.includes('even')) {
      target_semesters = [...EVEN_SEMESTERS]
    } else {
      const nums = extractedSem
        .map(s => parseInt(String(s).replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 8)
      target_semesters = nums.length > 0 ? Array.from(new Set(nums)).sort((a, b) => a - b) : [...ALL_SEMESTERS]
    }
  } else {
    const semStr = String(extractedSem).trim().toLowerCase()
    if (semStr === 'all') {
      target_semesters = [...ALL_SEMESTERS]
    } else if (semStr === 'odd') {
      target_semesters = [...ODD_SEMESTERS]
    } else if (semStr === 'even') {
      target_semesters = [...EVEN_SEMESTERS]
    } else if (semStr.includes(',')) {
      const nums = semStr
        .split(',')
        .map(s => parseInt(s.replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 8)
      target_semesters = nums.length > 0 ? Array.from(new Set(nums)).sort((a, b) => a - b) : [...ALL_SEMESTERS]
    } else {
      const num = parseInt(semStr.replace(/\D/g, ''), 10)
      if (!isNaN(num) && num >= 1 && num <= 8) {
        target_semesters = [num]
      } else {
        target_semesters = [...ALL_SEMESTERS]
      }
    }
  }

  return { target_departments, target_semesters }
}

/**
 * Determines if a document is relevant/visible to a student in institutional notices.
 * 
 * Rules:
 * A student can see notices that are:
 * 1. Targeted for user's semester across ALL departments (department = all AND semester = student's semester)
 * 2. Targeted for ALL semesters of user's department (department = student's department AND semester = all)
 * 3. Targeted specifically for user's department AND semester (department = student's department AND semester = student's semester)
 *
 * A notice meant for a different department (e.g., ECE 3rd sem) is strictly HIDDEN from a CSE student.
 */
export function isAudienceVisibleToStudent(
  doc: { target_departments?: string[] | null; target_semesters?: number[] | null },
  studentDept: string,
  studentSem: number
): boolean {
  const depts: string[] = doc.target_departments || []
  const sems: number[] = doc.target_semesters || []

  // Check if notice is targeted at ALL departments
  const isAllDepts = 
    depts.length === 0 ||
    depts.some(d => d.trim().toLowerCase() === 'all') ||
    ALL_DEPARTMENTS.every(d => depts.includes(d))

  // Check if notice is targeted at ALL semesters
  const isAllSems = 
    sems.length === 0 ||
    ALL_SEMESTERS.every(s => sems.includes(s))

  // 1. Universal campus-wide notice targeting all departments and all semesters
  if (isAllDepts && isAllSems) return true

  // 2. Department check: matches if all departments or specific department is included
  const matchesDept = isAllDepts || depts.includes(studentDept)

  // 3. Semester check: matches if all semesters or specific semester is included
  const matchesSem = isAllSems || sems.includes(studentSem)

  return matchesDept && matchesSem
}

