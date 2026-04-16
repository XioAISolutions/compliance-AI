# NI 45-106 Authority Corpus — Ingestion, Refresh, and Lawyer Usage

## What this is

A structured, retrievable knowledge base of **National Instrument 45-106 Prospectus Exemptions** — the Canadian Securities Administrators' (CSA) rule governing capital raises outside a prospectus. The corpus covers every section, division, part, and appendix of the 2025-12-04 CSA unofficial consolidation, plus the companion instruments an OM reviewer cites alongside it.

## Why it exists

The OM Reviewer persona ([`packages/agents/src/personas/om-reviewer.ts`](../packages/agents/src/personas/om-reviewer.ts)) is graded on whether every rule reference in its checklist, gap memo, and risk flags resolves to a real authority item in the cognition store. Before this corpus landed, only a 12-line stub of s. 2.9 was seeded — the other ~70 NI 45-106 section references came from model memory, which the judge loop cannot validate.

With the corpus in place:

- The retriever returns the actual rule text for section-specific queries ("four month hold period resale", "report exempt distribution ten days").
- Every `[cN]` citation in a reviewer deliverable has an authority to resolve against.
- The Ontario-specific overlay (OSC Rule 45-501, OSC SN 45-716) and the federal companion layer (NI 45-102 resale, CP 45-106CP, CSA SN 45-318) ship together so reviews land at lawyer-grade depth on first pass, not after iteration.

## Corpus contents

| Block                   | Items | Source                                                                                                                      |
| ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| NI 45-106 (full)        | 112   | [`packages/cognition/src/ni-45-106-authorities.ts`](../packages/cognition/src/ni-45-106-authorities.ts) — **generated**     |
| NI 45-102 resale        | 3     | [`packages/cognition/src/ni-45-106-companion-authorities.ts`](../packages/cognition/src/ni-45-106-companion-authorities.ts) |
| CP 45-106CP             | 1     | same file                                                                                                                   |
| CSA SN 45-318           | 1     | same file                                                                                                                   |
| OSC SN 45-716           | 1     | same file                                                                                                                   |
| Legacy Ontario EMD seed | 6     | [`packages/cognition/src/authorities.ts`](../packages/cognition/src/authorities.ts)                                         |

All items are spread into `ONTARIO_EMD_AUTHORITIES` and seeded into the cognition store at tenant bootstrap ([`apps/web/src/lib/bootstrap.ts`](../apps/web/src/lib/bootstrap.ts)).

## Structure of a CognitionItem

```ts
{
  id: "auth-ni-45-106-2.9-a",                              // Stable per section/chunk
  organizationId: "preview",                                // Re-tagged at bootstrap per tenant
  title: "NI 45-106 s. 2.9 — Offering memorandum",
  source: "National Instrument 45-106 Prospectus Exemptions (unofficial consolidation current to 2025-12-04)",
  jurisdiction: "ontario",
  registrationCategories: ["emd", "issuer"],                // Filters retrieval per persona
  content: "Section 2.9 — Offering memorandum\n\n2.9 (1) In British Columbia and Newfoundland and Labrador, the prospectus requirement does not apply to a distribution by an issuer...\n\nCross-references: s. 2.3; s. 2.10; Form 45-106F2; Form 45-106F4.\n\nSource: NI 45-106 unofficial consolidation current to 2025-12-04.",
}
```

### ID conventions

| Shape                                  | Example                              | What it means                                   |
| -------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `auth-ni-45-106-{section}`             | `auth-ni-45-106-2.3`                 | A whole section that fits under the size budget |
| `auth-ni-45-106-{section}-{letter}`    | `auth-ni-45-106-1.1-a`, `…-b`, `…-c` | Oversize section split across chunks            |
| `auth-ni-45-106-part-{n}`              | `auth-ni-45-106-part-2`              | A Part preamble                                 |
| `auth-ni-45-106-part-{n}-division-{d}` | `auth-ni-45-106-part-2-division-3`   | A Division within a Part                        |
| `auth-ni-45-106-f{n}`                  | `auth-ni-45-106-f19`                 | A Form heading                                  |
| `auth-ni-45-106-appendix-{letter}`     | `auth-ni-45-106-appendix-a`          | An Appendix                                     |
| `auth-ni-45-102-{section}`             | `auth-ni-45-102-2.5`                 | NI 45-102 resale section                        |
| `auth-cp-45-106-{section}`             | `auth-cp-45-106-2.9`                 | Companion Policy guidance                       |
| `auth-csa-sn-{n}` / `auth-osc-sn-{n}`  | `auth-csa-sn-45-318`                 | Staff notices                                   |

### Content shape

Every generated item starts with a heading line (`Section N.N — Title`), then the normalized rule body (paragraph-collapsed to strip PDF line wraps), then an appended **Cross-references** line listing cited sections/forms/parts, then a consolidation-date footer. The cross-ref block is appended to help BM25 recall items referenced by related vocabulary — e.g., a query about "form F4 risk acknowledgement" will now hit s. 2.3 because s. 2.3 cites F4 in its cross-references.

### registrationCategories map

Tells the retriever which personas care about which items. Shaped by audience rather than structure:

| Block                                   | Categories                     |
| --------------------------------------- | ------------------------------ |
| Part 1 (definitions)                    | `emd`, `pm`, `issuer`, `iiroc` |
| Part 2 Division 1 (capital raising)     | `emd`, `issuer`                |
| Part 2 Division 2 (transaction)         | `emd`, `issuer`                |
| Part 2 Division 3 (investment fund)     | `pm`, `issuer`                 |
| Part 2 Division 4 (employee/exec)       | `issuer`                       |
| Part 2 Division 5 (misc)                | `emd`, `issuer`                |
| Part 6 (reporting)                      | `issuer`, `emd`                |
| Form F1 (report of exempt distribution) | `issuer`, `emd`                |
| Form F2/F3 (OMs)                        | `emd`, `issuer`                |
| Form F4/F9 (risk acknowledgement)       | `emd`, `issuer`                |

Adjust in [`scripts/ingest-ni-45-106.mjs`](../scripts/ingest-ni-45-106.mjs) `REGISTRATION_MAP` and regenerate.

## Refreshing the corpus

When the CSA publishes a new consolidation:

```bash
# From the repo root. Replace with the new PDF path if different.
node scripts/ingest-ni-45-106.mjs ~/Downloads/ni_20260401_45-106_unofficial-consolidation.pdf
```

What this does:

1. Extracts the PDF text with `pdf-parse` (88 pages → ~189K chars for the 2025-12-04 consolidation).
2. Runs the sectioner — finds all Part / Division / section-number / Form / Appendix boundaries. Section numbers are matched at line start with a filter that rejects cross-reference artifacts like `1.1 [Definitions] unless…`.
3. Slices the body between boundaries, dedupes by keeping the first occurrence after the TOC.
4. Assigns Part/Division context to each section (via positional walk through the sorted slices).
5. Builds one `CognitionItem` per slice using canonical titles from the `SECTION_TITLES` map.
6. Splits oversize items (>1800 tokens ≈ 7200 chars) recursively on subsection `(1)` markers → paragraph breaks → sentence breaks → hard word boundary.
7. Appends cross-references and a source-date footer to each item.
8. Writes the generated TypeScript file `packages/cognition/src/ni-45-106-authorities.ts`.

After regenerating:

```bash
pnpm -w build                             # Confirm types
pnpm --filter @compliance-ai/cognition test   # Confirm corpus shape + retrieval
```

### When new sections appear

If the script prints a warning like:

```
⚠️  Section 2.44 has no canonical title — using body preview.
```

That means the new consolidation added sections the `SECTION_TITLES` map doesn't know. Add the title to [`scripts/ingest-ni-45-106.mjs`](../scripts/ingest-ni-45-106.mjs) by reading the Table of Contents in the new PDF, then re-run the script. The generator will otherwise fall back to a body-preview title which is usually fine but less stable.

## Lawyer usage — what to expect in retrieval

The OM Reviewer persona has access to this corpus at every chat turn. Typical queries and expected top hits:

| Query the reviewer issues                    | Top hit should start with                    |
| -------------------------------------------- | -------------------------------------------- |
| `accredited investor income threshold`       | `auth-ni-45-106-2.3`                         |
| `offering memorandum exemption`              | `auth-ni-45-106-2.9`                         |
| `minimum amount investment exemption 150000` | `auth-ni-45-106-2.10`                        |
| `private issuer shareholders 50`             | `auth-ni-45-106-2.4`                         |
| `family friends business associates`         | `auth-ni-45-106-2.5` or `2.6`                |
| `report exempt distribution ten days`        | `auth-ni-45-106-6.1`                         |
| `risk acknowledgement form 45-106F4`         | `auth-ni-45-106-6.5`                         |
| `four month hold period resale`              | `auth-ni-45-102-2.5`                         |
| `risk factor specific issuer boilerplate`    | `auth-cp-45-106-2.9` or `auth-csa-sn-45-318` |

These are exercised in [`packages/cognition/src/__tests__/ni-45-106-authorities.test.ts`](../packages/cognition/src/__tests__/ni-45-106-authorities.test.ts).

## What this corpus does NOT do

- **No embeddings** — retrieval is BM25 only until pgvector + embeddings land (Day 3+ roadmap). BM25 handles regulatory queries well because they are vocabulary-matched; add embeddings to improve paraphrased recall.
- **No Forms F1–F4 / F9 full text** — these forms are published as separate CSA PDFs. The consolidation references them but doesn't reproduce them. Form text can be ingested as a companion pass when needed (the script's `FORM_TITLES` map is already wired).
- **No interpretive opinions** — regulator enforcement decisions, court cases, and client-privileged opinions are out of scope; those belong in a separate caselaw / opinion layer.
- **No jurisdictional passport rules** — MI 11-102 (passport system) is referenced but not ingested. Add if/when cross-jurisdictional OMs are a prominent use case.
- **No 45-106 historical versions** — this is the current consolidation only. Version history is a separate corpus (not needed for today's reviewer).

## Related files

- [`packages/cognition/src/ni-45-106-authorities.ts`](../packages/cognition/src/ni-45-106-authorities.ts) — generated corpus (do not edit by hand)
- [`packages/cognition/src/ni-45-106-companion-authorities.ts`](../packages/cognition/src/ni-45-106-companion-authorities.ts) — hand-maintained companion instruments
- [`packages/cognition/src/authorities.ts`](../packages/cognition/src/authorities.ts) — spreads both into `ONTARIO_EMD_AUTHORITIES`
- [`packages/cognition/src/__tests__/ni-45-106-authorities.test.ts`](../packages/cognition/src/__tests__/ni-45-106-authorities.test.ts) — coverage + retrieval tests
- [`apps/web/src/lib/bootstrap.ts`](../apps/web/src/lib/bootstrap.ts) — seeds the corpus into the cognition store at tenant bootstrap
- [`packages/agents/src/personas/om-reviewer.ts`](../packages/agents/src/personas/om-reviewer.ts) — the persona that consumes this corpus
- [`scripts/ingest-ni-45-106.mjs`](../scripts/ingest-ni-45-106.mjs) — refresh generator

## Contributing

To extend the corpus:

1. **New regulation** (e.g., NI 31-103 Part 3 on registration categories) — add as a new hand-maintained file alongside `ni-45-106-companion-authorities.ts`, export via `packages/cognition/src/index.ts`, spread into `ONTARIO_EMD_AUTHORITIES`.
2. **New sections in a refreshed NI 45-106** — add the section number + title to `SECTION_TITLES` in the generator script, re-run.
3. **New staff notice** — add a `CognitionItem` to `CSA_STAFF_NOTICES_45` or create a new companion group. Follow the id convention `auth-{regulator}-{series}-{number}`.
4. **Tests** — extend [`ni-45-106-authorities.test.ts`](../packages/cognition/src/__tests__/ni-45-106-authorities.test.ts) with a retrieval case covering the new content vocabulary.

Never hand-edit the generated `ni-45-106-authorities.ts` — those edits will be wiped the next time the script runs. Persistent customizations go in the companion file or in the script itself.
