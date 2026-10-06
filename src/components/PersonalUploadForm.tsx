'use client'

import { useState, useRef } from 'react'
import { uploadPersonalDocument } from '@/app/student/my-documents/actions'
import { getErrorMessage } from '@/utils/errors'
import { useRouter } from 'next/navigation'

export function PersonalUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return

    // 20MB file limit check
    if (file.size > 20 * 1024 * 1024) {
      setError('File size exceeds the 20MB limit. Please upload a smaller PDF.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await uploadPersonalDocument(formData)

      if (!result.success) {
        setError(result.error || 'Failed to upload document')
        return
      }

      setSuccess(true)
      setFile(null)
      formRef.current?.reset()
      router.refresh()

      setTimeout(() => {
        setSuccess(false)
      }, 4000)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-[#dfe7e3] p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Upload Personal Document</h2>
      
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Document uploaded and secured successfully!</span>
        </div>
      )}

      <form ref={formRef} onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title</label>
          <input 
            type="text" 
            name="title" 
            required 
            placeholder="e.g. Offer Letter - Google"
            className="block w-full rounded-xl border border-gray-300 shadow-2xs focus:border-[#176b61] focus:ring-2 focus:ring-[#176b61]/20 text-xs sm:text-sm p-2.5 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">PDF File</label>
          <input 
            type="file" 
            name="file" 
            accept="application/pdf" 
            required 
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setSuccess(false)
              setError(null)
            }}
            className="block w-full text-xs sm:text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#edf6f3] file:text-[#176b61] hover:file:bg-[#dceee9] cursor-pointer border border-gray-200 rounded-xl p-2"
          />
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={!file || isLoading}
          className="w-full flex justify-center py-2.5 px-4 rounded-xl shadow-xs text-xs sm:text-sm font-semibold text-white bg-[#176b61] hover:bg-[#12564f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#176b61] disabled:opacity-50 cursor-pointer transition-colors"
        >
          {isLoading ? 'Uploading & Securing...' : 'Secure Upload'}
        </button>
      </form>
    </div>
  )
}
