# 🎓 Syntheus — Academic Intelligence Platform

> **The right information. To the right person. At the right time.**

Syntheus is an intelligent campus knowledge and academic coordination platform engineered for modern universities and educational institutions.

It transforms scattered campus notices, examination circulars, fee schedules, official timetables, and lecture resources into a structured, audience-targeted institutional knowledge base—delivering verified information directly to students and faculty while powering a source-grounded, private AI assistant.

---

## 💡 The Problem & The Solution

Universities generate hundreds of circulars, academic notices, and schedule updates every month. Critical information gets lost in message groups, buried in lengthy PDFs, or overlooked until deadlines have already passed.

Syntheus solves this through:
1. **Audience-Targeted Information Filtering:** Every document is indexed with granular department, semester, and section targeting rules.
2. **Academic Identity & Registration Security:** Strict database triggers and admin verification ensure that student records remain authoritative and immutable.
3. **Structured Timetables & Events:** Automatic extraction of weekly class schedules, exam dates, and registration deadlines into interactive calendar grids.
4. **Source-Grounded Student AI:** A local-embedding RAG assistant that answers questions with verifiable citations from official college documents and students' private study vaults.

---

## 🏛️ Platform Architecture & Features

```text
                                  SYNTHEUS ARCHITECTURE
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               │                                                         │
     Official Institutional KB                                 Personal Document Vault
  (Bucket: institutional-documents)                        (Bucket: personal-documents)
               │                                                         │
       AI Metadata Extraction                                   Encrypted PDF Storage
 (Category, Targeting, Events, Timetables)                     (<student_id>/<file>.pdf)
               │                                                         │
     Local Chunking & Embeddings                               Chunking & Embeddings
      (all-MiniLM-L6-v2, 384-dim)                            (all-MiniLM-L6-v2, 384-dim)
               │                                                         │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                  Student RAG Engine
                                            │
                               ┌────────────┴────────────┐
                               ▼                         ▼
                         Vector Search             Audience Filter
                       (pgvector Cosine)        (Dept, Sem, Sec Match)
                               │                         │
                               └────────────┬────────────┘
                                            ▼
                                  Groq LLM Intelligence
                                  (openai/gpt-oss-120b)
                                            │
                                            ▼
                                 Grounded Student Chat
                               + Verifiable Source Citations
```

### 1. 🛡️ Student Registration & Verification Workflow
- **Pending Claim Ingestion:** During signup, student registration records (`roll_number`, `institutional_name`, `department`, `semester`, `section`) are inserted into the database with `account_status: 'pending'`.
- **Academic Field Immutability:** A PostgreSQL security definer trigger (`protect_student_academic_fields()`) guarantees that non-admin users cannot mutate authoritative academic attributes or elevate their verification status.
- **Verification Notification Modals:**
  - **First-time Signup:** Interactive pop-up detailing the submitted registration record and informing the student that administrative verification is pending.
  - **Pending Login Interception:** If a registered student attempts to sign in before verification, access is intercepted and a status notification modal is displayed.
- **Administrator Review Directory:** College administrators can review pending claims with 1-click verification or suspension.

### 2. 🎯 Granular Audience Targeting
Documents, academic events, and timetables are filtered according to the canonical targeting rules:
- **Dimensions:** Department, Semester (1–8), and Section.
- **Wildcard Semantics:** A `NULL` document dimension matches all students in that dimension.
- **Strict Student Null Rule:** A student with a missing or null academic attribute never bypasses targeting rules, preventing unauthorized access.

### 3. 📂 16 Canonical Document Categories
Documents are partitioned across two core domains:
- **Institute Documents (11 Categories):**
  `notice`, `circular`, `schedule`, `calendar`, `syllabus`, `form`, `admission`, `registration`, `scholarship`, `placement`, `fees`
- **Study Resources (5 Categories):**
  `notes`, `reference_material`, `question_paper`, `question_bank`, `assignment`

### 4. 🗓️ Structured Academic Events & Timetables
- **Structured Events:** 10 canonical event types (`exam`, `assignment_deadline`, `registration_deadline`, `admission_deadline`, `scholarship_deadline`, `semester_start`, `semester_end`, `holiday`, `class_event`, `other`) extracted and surfaced in the student calendar.
- **Weekly Class Timetable:** Day-of-week class schedules with start/end timings, subject names, classroom numbers, and instructors.

### 5. 🤖 Grounded Student AI Assistant
- **Student-Only Scope:** AI Chat is restricted to authenticated, verified students.
- **Privacy Partitioning:** Queries search both verified institutional documents and the student's private uploaded files (`personal_documents`).
- **Citation Tracking:** Cited sources are persisted in `message_sources` and displayed alongside answers.
- **Local Embeddings:** Embeddings are generated client/server-side using `@xenova/transformers` (`all-MiniLM-L6-v2`), avoiding external embedding latency and API costs.

### 6. 🔒 Private Storage & Two-Phase Hard Deletion
- **Zero Public Buckets:** Storage uses private buckets (`institutional-documents` and `personal-documents`).
- **Short-Lived Signed URLs:** PDF previews and downloads utilize authenticated, time-limited signed URLs.
- **Reviewed Institutional Ingestion:** Admin uploads remain `processing` while the server extracts PDF text and writes chunks/embeddings. AI metadata, events, and timetable entries remain suggestions until an administrator reviews and explicitly saves them as a draft or publishes them.
- **Two-Phase Document Deletion:** Deleting a document disassociates historical message citations and document completion logs (`SET NULL`) to preserve audit trails before deleting database records and storage files.

---

## 🛠️ Technology Stack

| Layer | Technology | Specification |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Turbopack compilation |
| **Frontend** | React 19 / TypeScript | Strict mode type-safety |
| **Styling** | Tailwind CSS 4 | Custom design tokens & badges |
| **Database** | Supabase PostgreSQL | 14 canonical tables, 6 enums |
| **Vector Search** | PostgreSQL `pgvector` | HNSW cosine vector index (384-dim) |
| **Embeddings** | `@xenova/transformers` | Local ONNX `all-MiniLM-L6-v2` |
| **LLM Inference** | Groq Cloud | `openai/gpt-oss-120b` |
| **Authentication** | Supabase Auth + SSR | Server Action session validation |
| **Storage** | Supabase Storage | Private buckets + Signed URLs |
| **Route Protection** | Next.js 16 Proxy Middleware | Database-backed identity lookups |

---

## 📁 Repository Structure

```text
Syntheus/
├── src/
│   ├── app/
│   │   ├── admin/                      # Administrator dashboard & publishing studio
│   │   │   ├── students/actions.ts     # Student verification & directory actions
│   │   │   ├── actions.ts              # PDF ingestion, extraction, and lifecycle
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   └── chat/route.ts           # Streaming RAG assistant endpoint
│   │   ├── login/                      # Student & Admin sign-in flow
│   │   ├── signup/                     # Interactive student registration
│   │   ├── student/                    # Verified student portal
│   │   │   ├── archive/                # Past & expired circulars archive
│   │   │   ├── attention/              # Actionable notices & completion tracking
│   │   │   ├── calendar/               # Academic events & weekly timetable grid
│   │   │   ├── chat/                   # Student AI Assistant workspace
│   │   │   ├── my-documents/           # Encrypted personal document vault
│   │   │   ├── notices/                # Institutional circulars & document hub
│   │   │   │   └── [id]/page.tsx       # Authoritative PDF viewer & details
│   │   │   ├── study/                  # Lecture notes, textbooks, past papers
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx                # Student home & dashboard
│   │   ├── unauthorized/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx                    # Identity-based root router
│   ├── components/                     # Modular UI components
│   │   ├── AccountPendingModal.tsx     # Login pending verification modal
│   │   ├── AdminDocumentDirectory.tsx  # Admin document lifecycle management
│   │   ├── AdminStudentDirectory.tsx   # Admin student verification UI
│   │   ├── AdminUploadForm.tsx         # Document ingestion & AI review studio
│   │   ├── RegistrationPendingModal.tsx# Signup verification modal
│   │   ├── StudentCalendarView.tsx     # Weekly timetable grid & calendar timeline
│   │   ├── StudentChat.tsx             # Interactive RAG chat UI with citations
│   │   ├── StudyResourceFeed.tsx       # Filterable study material feed
│   │   └── UrgentNoticeCard.tsx        # High-priority notice cards
│   ├── types/
│   │   └── database.ts                 # Full TypeScript schema for 14 tables & 6 enums
│   ├── utils/
│   │   ├── audience.ts                 # Targeting rules & Student NULL enforcement
│   │   ├── auth.ts                     # Database domain table identity lookups
│   │   ├── constants.ts                # 16 Categories & 10 Event types metadata
│   │   ├── deadlines.ts                # Date parsing & cutoff calculations
│   │   ├── embeddings.ts               # Local Xenova embedding pipeline
│   │   ├── pdf.ts                      # PDF text extraction
│   │   ├── storage.ts                  # Private storage & signed URL utilities
│   │   └── supabase/                   # SSR server & client Supabase factories
│   └── proxy.ts                        # Route protection middleware
├── supabase/
│   └── migrations/
│       ├── 202610070000_syntheus_v1_canonical_schema.sql
│       ├── 202610070001_student_signup_and_security.sql
│       ├── 202610080000_enable_rag_and_storage_policies.sql
│       ├── 202610080001_harden_rag_chunk_access.sql
│       ├── 202610080002_trusted_personal_document_ingestion.sql
│       ├── 202610080003_private_document_storage.sql
│       └── 202610080004_atomic_chat_finalization.sql
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.17+ or v20+
- **Supabase Account**: With `pgvector` enabled
- **Groq API Key**: For fast LLM inference

### 2. Installation
```bash
git clone https://github.com/Malayek-Anwar/Syntheus.git
cd Syntheus
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Groq Cloud API Key
GROQ_API_KEY=gsk_your_groq_api_key
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is required for trusted institutional and personal document chunk ingestion. Never expose it through a `NEXT_PUBLIC_` variable or client code.

### 4. Database & Storage Setup
Execute the canonical migrations in order in your Supabase SQL Editor:
1. `supabase/migrations/202610070000_syntheus_v1_canonical_schema.sql`
2. `supabase/migrations/202610070001_student_signup_and_security.sql`
3. Apply the RAG access and trusted-ingestion migrations in timestamp order:
   - `supabase/migrations/202610080000_enable_rag_and_storage_policies.sql`
   - `supabase/migrations/202610080001_harden_rag_chunk_access.sql`
   - `supabase/migrations/202610080002_trusted_personal_document_ingestion.sql`
   - `supabase/migrations/202610080003_private_document_storage.sql`
   - `supabase/migrations/202610080004_atomic_chat_finalization.sql`
   - `supabase/migrations/202610080005_finalize_rag_security_and_relevance.sql`

The storage migration creates or enforces the private `institutional-documents` and `personal-documents` buckets, PDF-only MIME restrictions, and the 25 MiB file limit. It also applies owner/targeting-scoped storage policies. Document views use 15-minute signed URLs; do not make either bucket public or use permanent public URLs.

The final RAG migration removes any permissive institutional chunk policies, restores admin-only direct chunk access, and applies the 0.30 similarity gate in both authorized retrieval RPCs before RRF ordering and limiting. Apply it even if earlier RAG migrations have already been applied.

The chat finalization migration atomically saves assistant messages, authorized source-title snapshots, and conversation timestamps. Apply it before using the updated chat route.

After applying the migrations, run `supabase/tests/phase1_rag_security.sql` in the SQL Editor for read-only catalog checks of chunk RLS, anonymous access, owner policy presence, and the SQL relevance gates. Also verify personal upload and cross-student isolation using two dedicated active test accounts; do not use production student accounts for adversarial tests.

### 5. Running the Application
```bash
# Start local development server
npm run dev

# Run TypeScript type check
npx tsc --noEmit

# Create optimized production build
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the portal.

---

## 📜 License
This project is licensed under the MIT License.