/**
 * Utility functions for deadline calculations, active status, and automated archiving.
 */

/**
 * Parses a date or date-string safely into an ISO string, or returns null if invalid.
 */
export function safeIsoDate(val: string | Date | null | undefined): string | null {
  if (!val) return null
  try {
    const d = typeof val === 'string' ? new Date(val) : val
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

/**
 * Safely formats a date or date-string to YYYY-MM-DD input value without throwing.
 */
export function safeDateInputValue(val: string | Date | null | undefined): string {
  if (!val) return ''
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10)
  }
  const iso = safeIsoDate(val)
  return iso ? iso.split('T')[0] : ''
}

/**
 * Determines whether a notice deadline has passed.
 * - For date-only strings (e.g. "2026-10-06"), the notice remains active through 23:59:59.999
 *   of that day in the user's local timezone.
 * - For full timestamps with explicit hours/minutes, it expires at that exact time.
 */
export function isNoticeDeadlinePassed(
  deadline: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!deadline) return false

  if (typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const [year, month, day] = deadline.split('-').map(Number)
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)
    return endOfDay.getTime() < now.getTime()
  }

  const dateObj = typeof deadline === 'string' ? new Date(deadline) : deadline
  if (isNaN(dateObj.getTime())) return false

  const isMidnightIso =
    typeof deadline === 'string' &&
    (deadline.includes('T00:00:00.000Z') || deadline.includes('T00:00:00'))

  if (isMidnightIso) {
    const endOfDay = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000 - 1)
    return endOfDay.getTime() < now.getTime()
  }

  return dateObj.getTime() < now.getTime()
}

/**
 * Returns true if a notice is currently active (starts_at is past or null,
 * and deadline has NOT passed, and not marked as admin-archived).
 */
export function isNoticeActive(
  doc: {
    deadline?: string | Date | null
    starts_at?: string | Date | null
    is_archived?: boolean | null
  },
  now: Date = new Date()
): boolean {
  if (doc.is_archived) return false

  if (doc.starts_at) {
    const startsAt = new Date(doc.starts_at).getTime()
    if (!isNaN(startsAt) && startsAt > now.getTime()) {
      return false // Scheduled for future
    }
  }

  if (doc.deadline && isNoticeDeadlinePassed(doc.deadline, now)) {
    return false // Deadline has passed
  }

  return true
}

/**
 * Returns true if a notice is considered archived (either by admin flag
 * or automatically because its deadline has passed).
 */
export function isNoticeArchived(
  doc: {
    deadline?: string | Date | null
    is_archived?: boolean | null
  },
  now: Date = new Date()
): boolean {
  if (doc.is_archived) return true
  return isNoticeDeadlinePassed(doc.deadline, now)
}
