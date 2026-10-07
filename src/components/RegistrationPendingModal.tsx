'use client'

import { useRouter } from 'next/navigation'

interface RegistrationPendingModalProps {
  isOpen: boolean
  studentDetails: {
    name: string
    rollNumber: string
    department: string
    semester: string | number
    section?: string | null
    email: string
  }
}

export function RegistrationPendingModal({ isOpen, studentDetails }: RegistrationPendingModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-xs">
            ⏳
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            Status: Pending Verification
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Account Created — Verification Pending
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Your registration has been created and your profile details have been saved to the institutional database.
          </p>
        </div>

        {/* Submitted details summary card */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Full Name</span>
            <span className="font-bold text-gray-900">{studentDetails.name}</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Roll Number</span>
            <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
              {studentDetails.rollNumber}
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Department</span>
            <span className="font-semibold text-gray-900">{studentDetails.department}</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <span className="text-gray-500 font-medium">Semester</span>
            <span className="font-semibold text-gray-900">Semester {studentDetails.semester}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">Section</span>
            <span className="font-semibold text-gray-900">{studentDetails.section || 'None / Not distinguished'}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
          <p className="font-semibold flex items-center gap-1">
            <span>🛡️</span> Notice of Institutional Verification:
          </p>
          <p>
            Your record is currently <strong>not verified</strong> in the active college database. An administrator must verify your identity and roll number before your account is activated.
          </p>
          <p className="text-[11px] text-amber-800">
            Access to the student portal, course circulars, and AI assistant will be granted once your account status becomes active.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#176b61] hover:bg-[#12564f] shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Proceed to Sign In</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
