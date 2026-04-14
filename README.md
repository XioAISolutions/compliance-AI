# Compliance AI

Private compliance AI platform with citation-first retrieval. Every answer traces back to the exact document, page, and section.

Built by [XIO AI Solutions](https://github.com/XioAISolutions).

## What This Does

1. **Upload** compliance documents (PDF)
1. **Parse** into citation-ready chunks with source metadata
1. **Embed** chunks locally using Ollama (nomic-embed-text)
1. **Ask** questions in natural language
1. **Get** answers with verifiable citations to specific sections and pages

All processing runs locally. No compliance data leaves the device.

## Architecture

```
Next.js App (chat UI + document library + source viewer)
  /api/upload    -> PDF parse + chunk + embed
  /api/chat      -> SSE streaming RAG pipeline
  /api/sources   -> Citation source lookup

Local Vector Store (JSON-based, zero infrastructure)

Ollama (local inference)
  nomic-embed-text  (embeddings)
  llama3.1:8b       (generation)

/compliance-brain/  (structured knowledge store)
  /00-core/         thesis, architecture
  /01-corpus/       document chunks + vectors
  /03-eval/         test questions
  /04-audit/        query log (every question traced)
```

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) installed and running

```bash
ollama pull nomic-embed-text
ollama pull llama3.1:8b
```

## Setup

```bash
git clone https://github.com/XioAISolutions/compliance-ai.git
cd compliance-ai
cp .env.example .env.local
npm install
```

## Ingest Documents

Drop PDFs into `compliance-brain/01-corpus/raw/` then:

```bash
npm run ingest
```

Or upload through the UI.

## Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Internal Protocol

Agent handoffs use [CRUMB format](https://github.com/XioAISolutions/crumb-format).

## License

Proprietary. XIO AI Solutions.
