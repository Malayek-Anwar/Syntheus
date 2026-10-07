import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { isDocumentVisibleToStudent } from '@/utils/audience'
import { StudentCalendarView } from '@/components/StudentCalendarView'
import type { AcademicEvent, Timetable, TimetableEntry } from '@/types/database'

export default async function StudentCalendarPage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const { student, supabase } = auth

  // 1. Fetch academic events
  const { data: allEvents } = await supabase
    .from('academic_events')
    .select('*')
    .order('starts_at', { ascending: true })

  const visibleEvents: AcademicEvent[] = (allEvents ?? []).filter((ev) =>
    isDocumentVisibleToStudent(ev, {
      department: student.department,
      semester: student.semester,
      section: student.section,
    })
  )

  // 2. Fetch timetables and their entries
  const { data: allTimetables } = await supabase
    .from('timetables')
    .select('*, timetable_entries(*)')
    .order('created_at', { ascending: false })

  const visibleTimetables: Array<Timetable & { entries: TimetableEntry[] }> = (
    allTimetables ?? []
  )
    .filter((tt) =>
      isDocumentVisibleToStudent(tt, {
        department: student.department,
        semester: student.semester,
        section: student.section,
      })
    )
    .map((tt) => ({
      ...tt,
      entries: (tt.timetable_entries as TimetableEntry[]) || [],
    }))

  const studentDept = student.department || 'Campus Wide'
  const studentSem = student.semester || 1

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>📅</span> Academic Calendar & Timetables
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Weekly class lecture schedule, exam dates, deadlines, and institutional milestones.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3 py-1.5 rounded-full border border-[#cce5df]">
            {studentDept} • Sem {studentSem}
          </span>
        </div>
      </div>

      <StudentCalendarView
        events={visibleEvents}
        timetables={visibleTimetables}
      />
    </div>
  )
}
