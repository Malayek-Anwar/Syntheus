'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { EVENT_TYPE_META } from '@/utils/constants'
import type { AcademicEvent, Timetable, TimetableEntry, AcademicEventType } from '@/types/database'
import { formatInstitutionalDate } from '@/utils/deadlines'

interface StudentCalendarViewProps {
  events: AcademicEvent[]
  timetables: Array<Timetable & { entries: TimetableEntry[] }>
}

const DAYS_OF_WEEK = [
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
]

function formatTime(timeStr: string) {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const minute = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${ampm}`
}

export function StudentCalendarView({ events, timetables }: StudentCalendarViewProps) {
  const [activeTab, setActiveTab] = useState<'timetable' | 'events'>('timetable')
  const [selectedEventType, setSelectedEventType] = useState<string>('all')
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    return today >= 1 && today <= 6 ? today : 1
  })

  // Selected timetable (use the latest / first active timetable)
  const activeTimetable = timetables[0] || null

  const filteredEvents = events.filter((ev) => {
    if (selectedEventType === 'all') return true
    return ev.event_type === selectedEventType
  })

  // Group entries by day of week
  const entriesByDay = React.useMemo(() => {
    const map = new Map<number, TimetableEntry[]>()
    DAYS_OF_WEEK.forEach((d) => map.set(d.day, []))

    if (activeTimetable?.entries) {
      activeTimetable.entries.forEach((entry) => {
        const list = map.get(entry.day_of_week) || []
        list.push(entry)
        map.set(entry.day_of_week, list)
      })
    }

    // Sort entries by start_time
    map.forEach((entries) => {
      entries.sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    return map
  }, [activeTimetable])

  return (
    <div className="space-y-6">
      {/* View Switcher Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('timetable')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'timetable'
                ? 'bg-[#176b61] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>🗓️</span>
            <span>Weekly Timetable</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'events'
                ? 'bg-[#176b61] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>📅</span>
            <span>Academic Events & Deadlines</span>
            {events.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === 'events'
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {events.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'timetable' && activeTimetable && (
          <div className="text-xs text-gray-500 font-medium">
            Active Schedule:{' '}
            <span className="font-bold text-gray-800">{activeTimetable.name}</span>
          </div>
        )}
      </div>

      {/* TAB 1: WEEKLY TIMETABLE */}
      {activeTab === 'timetable' && (
        <div className="space-y-4">
          {!activeTimetable ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-gray-200 border-dashed space-y-3">
              <span className="text-4xl">⏱️</span>
              <h3 className="text-base font-bold text-gray-900">No official timetable published</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Your department has not uploaded an official structured timetable schedule for your semester yet.
              </p>
            </div>
          ) : (
            <div>
              {/* Day selector tabs (mobile / tablet friendly) */}
              <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDay(d.day)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
                      selectedDay === d.day
                        ? 'bg-[#176b61] text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>

              {/* Mobile Single Day View */}
              <div className="block sm:hidden space-y-3 mt-2">
                <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between">
                  <span>{DAYS_OF_WEEK.find((d) => d.day === selectedDay)?.name} Classes</span>
                  <span className="text-xs font-normal text-gray-500">
                    {entriesByDay.get(selectedDay)?.length || 0} sessions
                  </span>
                </h3>

                {(!entriesByDay.get(selectedDay) || entriesByDay.get(selectedDay)!.length === 0) ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-xs text-gray-400">
                    No classes scheduled for {DAYS_OF_WEEK.find((d) => d.day === selectedDay)?.name}.
                  </div>
                ) : (
                  entriesByDay.get(selectedDay)!.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-2 border-l-4 border-l-[#176b61]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-[#176b61]">
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </span>
                        {entry.room && (
                          <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            📍 {entry.room}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">{entry.subject}</h4>
                      {entry.instructor && (
                        <p className="text-xs text-gray-500">Instructor: {entry.instructor}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Full Week Schedule Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {DAYS_OF_WEEK.map((d) => {
                  const entries = entriesByDay.get(d.day) || []
                  const isToday = new Date().getDay() === d.day

                  return (
                    <div
                      key={d.day}
                      className={`bg-white rounded-2xl border transition-all ${
                        isToday
                          ? 'border-[#176b61] shadow-md ring-1 ring-[#176b61]/20'
                          : 'border-gray-200 shadow-2xs'
                      } overflow-hidden flex flex-col`}
                    >
                      <div
                        className={`px-4 py-3 border-b flex items-center justify-between ${
                          isToday ? 'bg-[#edf6f3] border-[#cce5df]' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <h4
                          className={`text-sm font-bold ${
                            isToday ? 'text-[#176b61]' : 'text-gray-800'
                          }`}
                        >
                          {d.name}
                        </h4>
                        {isToday ? (
                          <span className="text-[10px] font-bold uppercase bg-[#176b61] text-white px-2 py-0.5 rounded-full">
                            Today
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">
                            {entries.length} {entries.length === 1 ? 'class' : 'classes'}
                          </span>
                        )}
                      </div>

                      <div className="p-3 space-y-2.5 flex-1 divide-y divide-gray-100">
                        {entries.length === 0 ? (
                          <div className="py-8 text-center text-xs text-gray-400">
                            No scheduled classes
                          </div>
                        ) : (
                          entries.map((entry) => (
                            <div key={entry.id} className="pt-2.5 first:pt-0 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-bold text-[#176b61]">
                                  {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                                </span>
                                {entry.room && (
                                  <span className="font-medium bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                    {entry.room}
                                  </span>
                                )}
                              </div>
                              <h5 className="text-xs font-bold text-gray-900 leading-snug">
                                {entry.subject}
                              </h5>
                              {entry.instructor && (
                                <p className="text-[11px] text-gray-500">
                                  {entry.instructor}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACADEMIC EVENTS & DEADLINES */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-gray-200">
            <button
              onClick={() => setSelectedEventType('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer transition-all ${
                selectedEventType === 'all'
                  ? 'bg-[#176b61] text-white shadow-2xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setSelectedEventType('exam')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer transition-all ${
                selectedEventType === 'exam'
                  ? 'bg-[#176b61] text-white shadow-2xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              📝 Exams
            </button>
            <button
              onClick={() => setSelectedEventType('assignment_deadline')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer transition-all ${
                selectedEventType === 'assignment_deadline'
                  ? 'bg-[#176b61] text-white shadow-2xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              ⏰ Deadlines
            </button>
            <button
              onClick={() => setSelectedEventType('holiday')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap cursor-pointer transition-all ${
                selectedEventType === 'holiday'
                  ? 'bg-[#176b61] text-white shadow-2xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              🎉 Holidays
            </button>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-gray-200 border-dashed space-y-3">
              <span className="text-4xl">📅</span>
              <h3 className="text-base font-bold text-gray-900">No upcoming academic events</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No active exams, assignment deadlines, or calendar milestones match your selection.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => {
                const meta = EVENT_TYPE_META[ev.event_type as AcademicEventType] || {
                  label: ev.event_type,
                  icon: '📌',
                }
                const startDate = new Date(ev.starts_at)
                const endDate = ev.ends_at ? new Date(ev.ends_at) : null
                const isUpcoming = startDate > new Date()

                return (
                  <div
                    key={ev.id}
                    className="p-5 bg-white rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md hover:border-[#176b61]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#edf6f3] text-[#176b61] border border-[#cce5df]">
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                        </span>

                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isUpcoming
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {formatInstitutionalDate(startDate, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-gray-900 leading-snug">
                        {ev.title}
                      </h4>

                      {ev.description && (
                        <p className="text-xs text-gray-600 max-w-xl leading-relaxed">
                          {ev.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        {ev.all_day ? (
                          <span>All-day event</span>
                        ) : (
                          <span>
                            {formatInstitutionalDate(startDate, { hour: '2-digit', minute: '2-digit' })}
                            {endDate &&
                              ` – ${formatInstitutionalDate(endDate, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`}
                          </span>
                        )}
                        {ev.target_departments && (
                          <span>• {ev.target_departments.join(', ')}</span>
                        )}
                        {ev.target_semesters && (
                          <span>• Sem {ev.target_semesters.join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {ev.source_document_id && (
                      <div className="flex-shrink-0 sm:self-center">
                        <Link
                          href={`/student/notices/${ev.source_document_id}`}
                          className="px-3.5 py-1.5 bg-[#edf6f3] hover:bg-[#dceee9] text-[#176b61] font-semibold text-xs rounded-xl border border-[#cce5df] transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>View Official Notice</span>
                          <span>→</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
