import { createClient } from '@/utils/supabase/server'

export default async function InstitutionalNoticesPage() {
  const supabase = await createClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Institutional Notices</h1>
        <p className="text-gray-500 mt-1">Browse all published notices and circulars across the campus.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {documents?.map((doc) => (
            <li key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {doc.category}
                    </span>
                    <span className="text-sm font-medium text-gray-500">{doc.department}</span>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 truncate">
                      {doc.title}
                    </h3>
                  </a>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    Audience: {doc.audience} {doc.semester && `| Semester: ${doc.semester}`}
                  </p>
                </div>
                {doc.deadline && (
                  <div className="flex-shrink-0 text-right">
                    <span className="inline-flex items-center text-sm font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md ring-1 ring-inset ring-orange-600/20">
                      Due: {new Date(doc.deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
          {(!documents || documents.length === 0) && (
            <li className="p-12 text-center text-gray-500">
              No notices published yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
