import { createClient } from '@/utils/supabase/server'
import { PersonalUploadForm } from '@/components/PersonalUploadForm'
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton'
import { extractPersonalStoragePath } from '@/utils/storage'

export default async function MyDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rawDocuments } = await supabase
    .from('personal_documents')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  // Generate secure time-limited signed URLs for viewing private documents
  const documents = await Promise.all(
    (rawDocuments ?? []).map(async (doc) => {
      const storagePath = extractPersonalStoragePath(doc.file_url)
      let viewUrl = doc.file_url

      if (storagePath) {
        const { data: signedData } = await supabase.storage
          .from('personal_documents')
          .createSignedUrl(storagePath, 3600) // 1-hour secure signed URL

        if (signedData?.signedUrl) {
          viewUrl = signedData.signedUrl
        }
      }

      return {
        ...doc,
        view_url: viewUrl,
      }
    })
  )

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Private Documents</h1>
        <p className="text-gray-500 mt-1">These documents are private and can only be accessed by you.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="md:col-span-1">
          <PersonalUploadForm />
        </div>

        {/* Document List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your Files</h2>
            {documents && documents.length > 0 && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {documents.length} document{documents.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {documents && documents.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-200">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      PDF
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200">
                          🔒 1-hr Signed Access
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <a 
                      href={doc.view_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 shadow-2xs transition-colors"
                    >
                      View
                    </a>
                    <DeleteDocumentButton id={doc.id} fileUrl={doc.file_url} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No private documents uploaded yet</h3>
              <p className="mt-1 text-sm text-gray-500">Upload fee receipts, syllabus copies, or personal records to query them via AI.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
