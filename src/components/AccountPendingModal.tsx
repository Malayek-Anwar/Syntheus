'use client'

import { useRouter } from 'next/navigation'

interface AccountPendingModalProps {
  isOpen: boolean
  onClose?: () => void
  studentDetails?: {
    name?: string | null
    rollNumber?: string | null
    department?: string | null
    semester?: string | number | null
    section?: string | null
  }
}

export function AccountPendingModal({
  isOpen,
  onClose,
  studentDetails,
}: AccountPendingModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleDismiss = () => {
    if (onClose) {
      onClose()
    } else {
      router.replace('/login')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-xs">
            ⏳
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            Account Status: Pending Approval
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Record Not Verified Yet
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Your credentials are correct, but your student record has not been verified by an institutional administrator yet.
          </p>
        </div>

        {studentDetails && (studentDetails.name || studentDetails.rollNumber) && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-2 text-xs">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-200">
              Registration Claim On File
            </p>
            {studentDetails.name && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Name</span>
                <span className="font-bold text-gray-900">{studentDetails.name}</span>
              </div>
            )}
            {studentDetails.rollNumber && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Roll Number</span>
                <span className="font-mono font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                  {studentDetails.rollNumber}
                </span>
              </div>
            )}
            {studentDetails.department && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Department</span>
                <span className="font-semibold text-gray-900">{studentDetails.department}</span>
              </div>
            )}
            {studentDetails.semester && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Semester</span>
                <span className="font-semibold text-gray-900">Semester {studentDetails.semester}</span>
              </div>
            )}
            {studentDetails.section && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Section</span>
                <span className="font-semibold text-gray-900">{studentDetails.section}</span>
              </div>
            )}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5 text-amber-900">
            <span>🛡️</span> Security & Verification Notice:
          </p>
          <p>
            Access to institutional notices, timetables, and the academic AI assistant requires an active verified status confirmed by college authorities.
          </p>
          <p className="text-[11px] text-amber-800">
            Please allow up to 24 hours for administrator review. If urgent, contact your department coordinator.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#176b61] hover:bg-[#12564f] shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Understood</span>
          </button>
        </div>
      </div>
    </div>
  )
}
