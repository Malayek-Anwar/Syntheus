# 🎓 Syntheus

> **The right information. To the right person. At the right time.**

Syntheus is an AI-powered institutional information platform designed for universities and educational institutions.

It transforms scattered campus notices, assignments, deadlines, and other institutional documents into a structured knowledge base, then delivers relevant information to users based on their role and academic context.

Students can discover personalized campus updates, search institutional notices, and ask questions using a source-grounded AI assistant. They can also maintain a separate private document space for their own assignments, resumes, notes, and study materials.

---

## 💡 Why Syntheus?

Universities generate an enormous amount of information every day.

Notices get buried. Deadlines are missed. Students have to search through PDFs and message groups to find information that may already exist somewhere.

The problem isn't a lack of information.

**It's getting the right information to the right person at the right time.**

Syntheus creates an intelligent layer over institutional information to make that process more accessible, searchable, and personalized.

---

## ✨ Features

### 🏛️ Institutional Knowledge Base

Authorized administrators can upload official campus notices as PDFs.

Syntheus automatically extracts and organizes important metadata, including:

- Title
- Department
- Semester
- Category
- Deadlines
- Priority
- Intended audience

Documents are chunked and indexed for efficient retrieval.

### 🎯 Personalized Student Feed

Students provide their academic context during registration, including their department and semester.

The student portal then surfaces notices relevant to them instead of requiring them to search through the entire institutional repository.

### 📢 Campus Notices Hub

Students can browse and search the complete collection of published campus announcements.

This provides both:

- **Personalized discovery** — "What matters to me?"
- **Global search** — "What information exists?"

### 📄 Personal Document Vault

Students can upload their own private documents, such as:

- Assignments
- Resumes
- Study materials
- Personal academic documents

Personal documents are kept separate from official institutional information and are protected using Row Level Security.

### 🤖 AI Campus Assistant

Syntheus provides a conversational AI interface for asking questions about institutional and personal documents.

The assistant uses Retrieval-Augmented Generation (RAG) to retrieve relevant document content before generating an answer.

Responses are grounded in the available documents and include direct citations to their sources.

> Syntheus isn't just a chatbot that can read PDFs.
>
> **It turns institutional information into something people can actually use.**

---

## 🧠 Hybrid RAG

Syntheus uses a hybrid retrieval pipeline rather than relying solely on semantic similarity.

```text
                    User Query
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
       Vector Search          Full-Text Search
        (pgvector)             (PostgreSQL)
             │                     │
             └──────────┬──────────┘
                        ▼
             Reciprocal Rank Fusion
                        │
                        ▼
                Relevant Chunks
                        │
                        ▼
                    LLM (Groq)
                        │
                        ▼
              Grounded AI Response
                        │
                        ▼
                    Citations
```

### Retrieval

- **Semantic search:** PostgreSQL `pgvector`
- **Keyword search:** PostgreSQL full-text search
- **Ranking:** Reciprocal Rank Fusion (RRF)
- **Embeddings:** `all-MiniLM-L6-v2`
- **Embedding dimension:** 384

### AI

LLM inference is powered by Groq using `openai/gpt-oss-120b`.

Embeddings are generated locally using `@xenova/transformers`, avoiding third-party embedding API costs and reducing dependency on external embedding services.

---

## 🔐 Privacy & Access Control

Syntheus separates official institutional information from user-owned personal documents.

Supabase Row Level Security (RLS) is used to ensure that:

- Published institutional documents are accessible to authenticated users.
- Students can only manage their own personal documents.
- Users can only access their own chat history.
- Personal document data remains isolated from other users.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 |
| Frontend | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI Interface | Vercel AI SDK |
| LLM | Groq |
| Model | `openai/gpt-oss-120b` |
| Embeddings | `@xenova/transformers` |
| Embedding Model | `all-MiniLM-L6-v2` |
| Document Parsing | `pdf-parse` |
| Database | Supabase PostgreSQL |
| Vector Search | `pgvector` |
| Keyword Search | PostgreSQL Full-Text Search |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Security | Supabase Row Level Security |

---

## 🏗️ Architecture

```text
                         SYNTHEUS
                            │
              ┌─────────────┴─────────────┐
              │                           │
       Official Documents           Personal Documents
              │                           │
              ▼                           ▼
       PDF Extraction               Private Storage
              │                           │
              ▼                           │
       AI Metadata Extraction             │
              │                           │
              ▼                           │
        Chunking + Embeddings             │
              │                           │
              ▼                           ▼
       Institutional KB             Personal KB
              │                           │
              └─────────────┬─────────────┘
                            ▼
                      Hybrid Retrieval
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
             pgvector             Full-Text
            Semantic Search         Search
                 │                     │
                 └──────────┬──────────┘
                            ▼
                           RRF
                            │
                            ▼
                    Relevant Context
                            │
                            ▼
                         Groq LLM
                            │
                            ▼
                   Grounded Response
                            │
                            ▼
                        Citations
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project
- A Groq API key

### 1. Clone the repository

```bash
git clone https://github.com/Malayek-Anwar/Syntheus.git
cd Syntheus
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

GROQ_API_KEY=gsk_your_groq_api_key
```

### 4. Configure Supabase

Enable the `pgvector` extension and create the required database tables, indexes, RLS policies, and hybrid-search function.

The required SQL schema is available in the project documentation.

Create the following storage buckets:

- `documents` — official institutional documents
- `personal_documents` — private user documents

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 👤 User Roles

### Student

Students can:

- View their personalized notice feed
- Browse campus announcements
- Search institutional information
- Chat with the AI assistant
- Upload and query personal documents

### Administrator

Administrators can:

- Upload institutional notices
- Review AI-extracted metadata
- Manage published documents
- Preview uploaded PDFs
- Remove outdated documents
- Trigger document indexing

---

## 📁 Project Structure

```text
├── public/
│
├── src/
│   ├── app/
│   │   ├── admin/              # Admin dashboard and notice management
│   │   ├── api/
│   │   │   └── chat/           # Streaming RAG chat API
│   │   ├── login/              # Authentication
│   │   ├── signup/             # Registration and user context
│   │   ├── student/            # Student portal
│   │   │   ├── notices/        # Campus notice hub
│   │   │   ├── chat/           # AI assistant
│   │   │   └── my-documents/   # Personal document vault
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/             # Reusable UI components
│   │
│   ├── utils/
│   │   ├── embeddings.ts       # Local embedding pipeline
│   │   ├── pdf.ts              # PDF text extraction
│   │   ├── errors.ts           # Error utilities
│   │   └── supabase/            # Supabase clients and helpers
│   │
│   └── middleware.ts            # Authentication and route protection
│
├── package.json
└── tsconfig.json
```

---

## 🗺️ Roadmap

### Current Prototype

- [x] Role-based authentication
- [x] Admin document management
- [x] AI-assisted metadata extraction
- [x] Institutional document storage
- [x] Personalized student notice feed
- [x] Campus notice search
- [x] Personal document workspace
- [x] Hybrid vector + keyword retrieval
- [x] Local document embeddings
- [x] RAG-based AI assistant
- [x] Source-grounded responses
- [x] Persistent chat history
- [x] Row Level Security

### Future

- [ ] Automatic deadline and event tracking
- [ ] Intelligent notifications
- [ ] Document relationship detection
- [ ] Duplicate detection
- [ ] Document version comparison
- [ ] Faculty-specific portal
- [ ] Administration-specific portal
- [ ] Advanced institutional analytics
- [ ] More granular permissions and workflows

---

## 🎯 Vision

Syntheus aims to evolve from a campus document assistant into an **intelligent institutional information layer**.

The long-term goal is simple:

> **Institutions shouldn't have to repeatedly tell people where information is. Syntheus should understand the information and help people find what matters to them.**

---

## 🏆 Smart India Hackathon 2026

Syntheus is being developed as a prototype for the **Smart India Hackathon 2026** internal hackathon.

The project focuses on the challenge of information overload in educational institutions and explores how document intelligence, personalized information delivery, and grounded generative AI can improve access to institutional knowledge.

---

## 📜 License

This project is licensed under the MIT License.