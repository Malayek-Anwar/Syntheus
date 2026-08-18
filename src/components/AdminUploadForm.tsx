'use client'

import { useState } from 'react'
import { parsePDF, publishDocument, type ExtractedData } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'

export function AdminUploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const router = useRouter()

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setIsLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    const result = await parsePDF(formData)
    
    if (!result.success || !result.data) {
      setError(result.error || 'Failed to parse PDF')
      setIsLoading(false)
      return
    }

    setExtractedData(result.data)
    setIsLoading(false)
  }

  const handlePublish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!extractedData) return

    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    const finalData: ExtractedData = {
      ...extractedData,
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      audience: formData.get('audience') as string,
      department: formData.get('department') as string,
      semester: formData.get('semester') as string,
      dates: formData.get('dates') as string,
      deadline: formData.get('deadline') as string,
      priority: formData.get('priority') as string,
    }

    const result = await publishDocument(finalData)
    
    if (!result.success) {
      setError(result.error || 'Failed to publish')
      setIsLoading(false)
      return
    }

    alert('Document published successfully!')
    setExtractedData(null)
    setFile(null)
    setIsLoading(false)
    router.refresh()
  }

  if (extractedData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Review & Publish Document</h2>
        <form onSubmit={handlePublish} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input type="text" name="title" defaultValue={extractedData.title} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input type="text" name="category" defaultValue={extractedData.category} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Audience</label>
              <input type="text" name="audience" defaultValue={extractedData.audience} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <input type="text" name="department" defaultValue={extractedData.department} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Semester</label>
              <input type="text" name="semester" defaultValue={extractedData.semester} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dates</label>
              <input type="text" name="dates" defaultValue={extractedData.dates} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Deadline (ISO Format)</label>
              <input type="text" name="deadline" defaultValue={extractedData.deadline || ''} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select name="priority" defaultValue={extractedData.priority} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm p-2 border">
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
          
          {error && <p className="text-red-600 text-sm">{error}</p>}
          
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setExtractedData(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? 'Publishing...' : 'Publish Document'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Upload New Document</h2>
      <form onSubmit={handleUpload} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">PDF Document</label>
          <input 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 cursor-pointer border border-gray-200 rounded-md p-2"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={!file || isLoading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
        >
          {isLoading ? 'Uploading & Extracting Data...' : 'Upload & Extract Data'}
        </button>
      </form>
    </div>
  )
}
