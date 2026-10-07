import { createClient } from '@/utils/supabase/server'
import { verifyStudentSession } from '@/utils/auth'
import { redirect } from 'next/navigation'
import { PersonalUploadForm } from '@/components/PersonalUploadForm'
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton'
import { getPersonalSignedUrl } from '@/utils/storage'

export default async function MyDocumentsPage() {
  const auth = await verifyStudentSession()
  if (!auth.authorized || !auth.student) {
    redirect('/login')
  }

  const supabase = auth.supabase
  const student = auth.student

  const { data: rawDocuments } = await supabase
    .from('personal_documents')
    .select('*')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })

  // Generate secure time-limited signed URLs for viewing private documents
  const documents = await Promise.all(
    (rawDocuments ?? []).map(async (doc) => {
      const viewUrl = (await getPersonalSignedUrl(supabase, doc.storage_path, 3600)) || ''
      return {
        ...doc,
        view_url: viewUrl,
      }
    })
  )

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#dfe7e3]">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Private Knowledge Vault</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Personal documents uploaded here are isolated to your student account and can be queried directly via AI Chat.
          </p>
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center text-xs font-semibold text-[#176b61] bg-[#edf6f3] px-3.5 py-1.5 rounded-full border border-[#cce5df]">
            🔒 Owner-Isolated
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="md:col-span-1">
          <PersonalUploadForm />
        </div>

        {/* Document List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Your Private Files</h2>
            {documents && documents.length > 0 && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {documents.length} document{documents.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {documents && documents.length > 0 ? (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden divide-y divide-gray-200">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-10 h-10 rounded-lg bg-[#edf6f3] text-[#176b61] border border-[#cce5df] flex items-center justify-center flex-shrink-0 font-bold text-xs">
                      PDF
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{Math.round(doc.file_size / 1024)} KB</span>
                        <span>•</span>
                        <span className="text-[#176b61] font-medium bg-[#edf6f3] px-1.5 py-0.5 rounded text-[10px] border border-[#cce5df]">
                          🔒 Signed Access
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.view_url && (
                      <a
                        href={doc.view_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-50 shadow-2xs transition-colors"
                      >
                        View
                      </a>
                    )}
                    <DeleteDocumentButton id={doc.id} fileUrl={doc.storage_path} />
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
              <p className="mt-1 text-xs text-gray-500">Upload course notes, syllabi, or fee receipts to query them via AI.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
