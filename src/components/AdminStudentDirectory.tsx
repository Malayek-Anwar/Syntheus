'use client'

import { useState, useMemo } from 'react'
import type { Student } from '@/types/database'
import { verifyStudentAccount, suspendStudentAccount } from '@/app/admin/students/actions'
import { useRouter } from 'next/navigation'

interface AdminStudentDirectoryProps {
  students: Student[]
}

type StatusTab = 'pending' | 'active' | 'suspended' | 'all'

export function AdminStudentDirectory({ students = [] }: AdminStudentDirectoryProps) {
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const router = useRouter()

  const counts = useMemo(() => {
    let pending = 0
    let active = 0
    let suspended = 0

    students.forEach((s) => {
      if (s.account_status === 'pending') pending++
      else if (s.account_status === 'active') active++
      else if (s.account_status === 'suspended') suspended++
    })

    return {
      pending,
      active,
      suspended,
      all: students.length,
    }
  }, [students])

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (activeTab !== 'all' && s.account_status !== activeTab) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchRoll = (s.roll_number || '').toLowerCase().includes(q)
        const matchName = (s.institutional_name || '').toLowerCase().includes(q)
        const matchDept = (s.department || '').toLowerCase().includes(q)
        return matchRoll || matchName || matchDept
      }

      return true
    })
  }, [students, activeTab, searchQuery])

  const handleVerify = async (studentId: string) => {
    setProcessingId(studentId)
    setActionError(null)
    try {
      const res = await verifyStudentAccount(studentId)
      if (!res.success) {
        setActionError(res.error || 'Failed to verify student')
      } else {
        router.refresh()
      }
    } catch {
      setActionError('An error occurred while verifying the student.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleSuspend = async (studentId: string) => {
    setProcessingId(studentId)
    setActionError(null)
    try {
      const res = await suspendStudentAccount(studentId)
      if (!res.success) {
        setActionError(res.error || 'Failed to suspend student')
      } else {
        router.refresh()
      }
    } catch {
      setActionError('An error occurred while suspending the student.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Student Academic Verification</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Review student registration claims and approve access to the institutional portal.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by roll number or name..."
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 rounded-xl bg-white border border-gray-300 shadow-2xs focus:border-[#176b61] focus:ring-1 focus:ring-[#176b61] transition-all placeholder:text-gray-400"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 p-0.5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
          {actionError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#dfe7e3]">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-amber-50 bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>Pending Claims</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.pending}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#176b61] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-[#edf6f3] bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>Verified (Active)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.active}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suspended')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'suspended'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>Suspended</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'suspended' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.suspended}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-[#dfe7e3]'
          }`}
        >
          <span>All Students</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {counts.all}
          </span>
        </button>
      </div>

      {/* Student List */}
      {filteredStudents.length > 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-[#dfe7e3] overflow-hidden divide-y divide-[#dfe7e3]">
          {filteredStudents.map((student) => {
            const isPending = student.account_status === 'pending'
            const isActive = student.account_status === 'active'
            const isSuspended = student.account_status === 'suspended'
            const isProcessing = processingId === student.id

            return (
              <div
                key={student.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfcfb] transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                      {student.roll_number || 'No Roll #'}
                    </span>

                    {isPending && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200 flex items-center gap-1">
                        <span>⏳</span>
                        <span>PENDING VERIFICATION</span>
                      </span>
                    )}

                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 flex items-center gap-1">
                        <span>✓</span>
                        <span>ACTIVE / VERIFIED</span>
                      </span>
                    )}

                    {isSuspended && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-800 rounded-full border border-red-200">
                        SUSPENDED
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    {student.institutional_name || student.display_name || 'Anonymous Student'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 pt-0.5">
                    <span className="text-slate-700 font-medium">{student.department || 'No Dept'}</span>
                    <span>·</span>
                    <span>Sem {student.semester || 'N/A'}</span>
                    {student.section && (
                      <>
                        <span>·</span>
                        <span>Sec {student.section}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>Registered {new Date(student.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 pt-2 sm:pt-0">
                  {isPending && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleVerify(student.id)}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <span>✓</span>
                      <span>{isProcessing ? 'Verifying...' : 'Verify & Activate'}</span>
                    </button>
                  )}

                  {isActive && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleSuspend(student.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}

                  {isSuspended && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleVerify(student.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#176b61] hover:bg-[#edf6f3] border border-[#cce5df] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Restore & Activate
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed space-y-2">
          <span className="text-3xl">🎓</span>
          <h3 className="text-sm font-bold text-gray-900">
            {searchQuery ? 'No students found matching search' : `No ${activeTab !== 'all' ? activeTab : ''} student records`}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'All student claims have been reviewed and verified!'
              : 'Registered students will appear in this directory.'}
          </p>
        </div>
      )}
    </div>
  )
}
