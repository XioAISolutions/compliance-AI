# Third-party notices

`compliance-AI` adapts architectural patterns from several open-source
projects. No source code is copied verbatim; every pattern has been
reimplemented in TypeScript against our own data model. This file records
where each pattern came from and the license it was released under.

## GAIR-NLP/ASI-Evolve (Apache License 2.0)

Upstream: <https://github.com/GAIR-NLP/ASI-Evolve>

Patterns lifted:

- **Cognition store interface** (`packages/cognition/src/types.ts`,
  `packages/cognition/src/in-memory.ts`) — method signatures and the
  `(item, score)` retrieval shape mirror
  `cognition/cognition.py`. Backend is in-process Map today, pgvector in
  the Day 3+ plan; FAISS + sentence-transformers deliberately not ported.
- **LLM-as-judge persona** (`packages/agents/src/personas/judge.ts`) —
  verdict-only output shape, parser defensiveness, and the
  `READY_TO_SUBMIT / ITERATE / REWRITE` token ladder.
- **Drafter ↔ judge tight loop** (`packages/agents/src/loop.ts`) — the
  round-based structure from `pipeline/evolve.py`, simplified to a
  two-role loop (our judge is binary-ish so the analyzer role folds in).
- **Samplers** (`packages/agents/src/sampler.ts`) — UCB1 + island picks
  from `database/algorithms/` ported to pure functions.
- **Audit-trail schema** (`packages/db/src/schema/control_revisions.ts`)
  — parent-linked revision shape from `database/database.py`.

License terms preserved inline in file headers where material patterns
were lifted. No third-party source is redistributed.

## bcurts/agentchattr (license: MIT, see upstream)

Upstream: <https://github.com/bcurts/agentchattr>

Patterns lifted:

- **Participant registry** (`packages/chat-structure/src/registry.ts`) —
  identity objects with color + initials + description per agent, same
  concept as `registry.py`.
- **@mention router + loop guard**
  (`packages/chat-structure/src/mentions.ts`,
  `packages/agents/src/loop.ts`) — parse `@id` tokens out of prose and
  route the next turn; `max_agent_hops` guard prevents runaway chains
  (mirrors `router.py`).
- **Typed in-process tool calls**
  (`packages/chat-structure/src/tools.ts`) — `cite_authority`,
  `flag_gap`, `request_review`, `hand_off` replace the MCP tool surface
  (`chat_send` / `chat_read` / `chat_claim`) with a compliance-domain
  vocabulary. Our agents emit `{{tool:<name> <json>}}` spans the loop
  coordinator parses into typed chips; their agents call MCP tools from
  terminal wrappers.
- **JSONL transcript** (`packages/chat-structure/src/transcript.ts`) —
  per-matter monotonic-seq JSONL persistence (mirrors `store.py`).
- **Multi-persona timeline UI** (`apps/web/src/app/matters/[id]/Timeline.tsx`,
  `AgentPill.tsx`) — colored identity pills, reply-threaded bubbles,
  status dots, round chips.

## abhigyanpatwari/GitNexus (license: MIT, see upstream)

Upstream: <https://github.com/abhigyanpatwari/GitNexus>

Patterns lifted:

- **Evidence graph** (`apps/web/src/lib/evidence-graph.ts`) — graph as
  primary interface rather than text-first view; node kinds +
  colored-by-kind + force-layout. Ours are compliance artifacts
  (matter/document/authority/citation/agent-turn/gap) rather than code
  symbols.
- **Sigma.js + Graphology + force-atlas2 canvas**
  (`apps/web/src/app/matters/[id]/GraphView.tsx`) — same rendering stack
  (Sigma.js 3 + Graphology). Uses the dependencies published by GitNexus
  upstream (`sigma`, `graphology`, `graphology-layout-forceatlas2`).
- **360° context panel**
  (`apps/web/src/app/matters/[id]/ContextPanel.tsx`) — incoming /
  outgoing / metadata decomposition for a selected node.
- **Hybrid search**
  (`packages/cognition/src/in-memory.ts`) — BM25 + (reserved) semantic
  via reciprocal-rank-fusion, with a `searchMode` switch matching
  GitNexus's hybrid retrieval layer. BM25 is a clean-room TS port;
  semantic is stubbed until pgvector + embeddings land.

## License posture

`compliance-AI` is Apache-2.0 licensed. The three upstream projects above
are Apache-2.0 (ASI-Evolve) and MIT (agentchattr, GitNexus) — both
compatible with our distribution. Their attribution lives here; file
headers call out the lifted pattern at the site of the port.
