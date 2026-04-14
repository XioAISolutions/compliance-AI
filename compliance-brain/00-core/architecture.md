# Architecture

## Ingestion pipeline

```
PDF Upload
  -> pdf-parse (text + page count)
  -> buildPageMap              (per-line -> page number)
  -> detectHeading / findHeadings  (regulatory heading conventions)
  -> buildSections             (parent-linked section tree)
  -> chunkBody                 (paragraph-packing within each section, ~500 tokens)
  -> persist: <file>-chunks.json, <file>-sections.json
  -> embed (nomic-embed-text, per-chunk text = fileName + breadcrumb + content)
  -> persist: embeddings.json (keyed by chunkId)
  -> buildGraph                (structural CONTAINS + PARENT_OF edges,
                                REFERENCES edges from cross-reference regex)
  -> persist: graph.json
```

## Retrieval + answer pipeline

```
Question
  -> hybridSearch
       -> vectorStore.rankAll  (cosine similarity, all chunks)
       -> BM25 (in-memory, built per query — fine at prototype scale)
       -> Reciprocal Rank Fusion (k=60)
       -> top-K (default 5)
  -> buildContext (tag each chunk [S1:§4.3], include file + breadcrumb + page)
  -> Ollama chat stream (temperature 0.1)
     System prompt forces [[doc:ref]] citations; no claim without a citation.
  -> extractAndValidateCitations (strip hallucinated tags)
  -> SSE: { text, citations, meta }
  -> audit log entry
```

## Source panel

```
click [[S1:§4.3]] in chat
  -> /api/sources?chunkId=...
  -> getContext(chunkId)
       -> parents (ancestor Section chain)
       -> cites   (outgoing REFERENCES edges)
       -> citedBy (incoming REFERENCES edges on this section)
  -> rendered with clickable cross-navigation
```

## Knowledge graph schema

Typed nodes, one generic edge table with a `type` property — this shape
keeps LLM-written Cypher clean and queries fast:

- Node types: `Document`, `Section`, `Chunk`
- Edge types:
  - `CONTAINS`    Document -> top-level Section, Section -> Chunk (for orphans)
  - `PARENT_OF`   Section -> child Section
  - `REFERENCES`  Chunk -> Section (resolved cross-reference)
  - `MENTIONS`    Chunk -> unresolved textual ref (audit trail for broken cites)

Cross-reference extraction patterns: `Section N`, `§N`, `Article N`, `Part N`,
`Chapter N`, `Clause N`, `paragraph N` — where `N` is numeric/roman/dotted.

## Key decisions

1. **Local-first.** All inference via Ollama. No data leaves the device.
2. **Citation validation.** Hallucinated `[[Sn:ref]]` with unknown tags are
   stripped from the rendered answer server-side.
3. **Split store.** Vectors live in `embeddings.json` keyed by chunkId;
   chunks live in per-document `*-chunks.json`. Joined by id at query time.
   Avoids rewriting big content blobs on every re-index.
4. **Hybrid retrieval.** BM25 catches regulatory jargon and exact section refs;
   dense vectors catch paraphrase. RRF avoids score-normalization headaches.
5. **Heading-aware chunking.** Chunks inherit the full section breadcrumb,
   which improves both retrieval context and citation accuracy.
6. **JSON graph store.** No external DB for prototype. Swap for Kuzu or
   LadybugDB when scale warrants it.
7. **Low temperature (0.1).** Precision over creativity for compliance.

## Agent handoff protocol

CRUMB format — https://github.com/XioAISolutions/crumb-format

## Hardware target

- Dev: Mac Mini M4 (8B models)
- Production: MacBook Pro M5 Max 128GB (70B models)
- Mirror: MacBook Air M5 (partner visibility)
