import { createClient } from '@/utils/supabase/server'
import { HomeSearchBar } from '@/components/HomeSearchBar'

export default async function StudentHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const department = user?.user_metadata?.department || ''
  const semester = user?.user_metadata?.semester || ''

  // Fetch documents that are published and relevant to the student
  // We use a broad OR condition to catch specific department mentions OR general 'All' documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('is_published', true)
    .or(`department.ilike.%${department}%,department.ilike.%all%,audience.ilike.%all%`)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      {/* RAG Search Bar */}
      <HomeSearchBar />

      {/* Personalized Feed */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Your Personalized Feed</h2>
          <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {department} • {semester}
          </span>
        </div>

        {documents && documents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((doc) => (
              <a 
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {doc.category}
                  </span>
                  {doc.priority?.toLowerCase() === 'high' && (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                      High Priority
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {doc.title}
                </h3>
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span>{doc.department}</span>
                  {doc.deadline && (
                    <span className="flex items-center text-orange-600 font-medium">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Due {new Date(doc.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No recent notices found for your department.</p>
          </div>
        )}
      </div>
    </div>
  )
}
