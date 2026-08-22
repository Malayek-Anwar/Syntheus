'use client'

import { useState } from 'react'
import { uploadPersonalDocument } from '@/app/student/my-documents/actions'
import { useRouter } from 'next/navigation'

export function PersonalUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)

    const result = await uploadPersonalDocument(formData)
    
    if (!result.success) {
      setError(result.error || 'Failed to upload')
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setFile(null)
    ;(e.target as HTMLFormElement).reset()
    setIsLoading(false)
    router.refresh()

    setTimeout(() => {
      setSuccess(false)
    }, 4000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Personal Document</h2>
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Document uploaded and secured successfully!</span>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Title</label>
          <input 
            type="text" 
            name="title" 
            required 
            placeholder="e.g. Offer Letter - Google"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
          <input 
            type="file" 
            name="file"
            accept="application/pdf"
            required
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setSuccess(false)
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 cursor-pointer border border-gray-200 rounded-md p-2"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={!file || isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Uploading & Securing...' : 'Secure Upload'}
        </button>
      </form>
    </div>
  )
}
