# Architecture

## Core Pipeline

```
PDF Upload -> Parse -> Chunk (500 tokens) -> Embed (nomic-embed-text) -> Vector Store (local JSON)
User Question -> Embed -> Vector Search (top 5) -> Build Context -> LLM Generate -> Validate Citations -> Return
```

## Key Decisions

1. Local-first: All inference via Ollama. No data leaves the device.
1. Citation validation: Hallucinated citations are stripped post-generation.
1. JSON vector store: No external DB for prototype. Swap to Qdrant for scale.
1. Low temperature (0.1): Precision over creativity for compliance.

## Agent Handoff Protocol

Uses CRUMB format (https://github.com/XioAISolutions/crumb-format)

## Hardware Target

- Dev: Mac Mini M4 (8B models)
- Production: MacBook Pro M5 Max 128GB (70B models)
- Mirror: MacBook Air M5 (partner visibility)
