# Client demo hand-off checklist

How to give a prospect or design-partner a working tour of the Railway preview
deployment without accidentally leaking private data or leaving them confused
about what the demo actually does.

## What ships with the demo (and what doesn't)

**Ships in the repo** (safe, public, no action needed):

- The four seed control catalogs in `packages/frameworks/src/{soc2,gdpr,eu-ai-act,iso-27001}.ts`
- The four agent personas (drafter, reviewer, evidence-collector, risk-assessor)
- The `/controls` catalog index and per-control chat UI

**Does *not* ship in the repo** — anything you uploaded manually to the preview
deployment (sample offering memos, regulatory-authority PDFs, policy drafts,
etc.) lives only on the Railway instance and on your local machine. If a
prospect asks "send me the document you uploaded to it," those files are *your*
files, not the repo's.

## Before you forward any uploaded document

Run this checklist on every file, every time:

- [ ] **Source is public or synthetic.** Regulator releases (SEC, FCA, EBA,
      ICO, ENISA) are safe. Vendor templates marked "sample" are safe.
      Anything derived from a real client engagement is **not** safe — swap in
      a public analogue.
- [ ] **No hidden metadata.** Run `exiftool -all= file.pdf` or re-export as PDF
      to strip author names, revision history, and tracked changes.
- [ ] **No embedded credentials.** Search the file for API keys, tokens, and
      internal URLs before sending.
- [ ] **Filename is neutral.** Rename `ACME_Corp_Q3_offering_memo_FINAL.pdf`
      to something like `sample-offering-memo.pdf`.

## What to actually send the prospect

For a "let me try it myself" hand-off, send:

1. The preview URL (e.g. `https://compliance-ai-preview-production.up.railway.app/`)
2. The **exact same source files** you uploaded into the demo matter, so their
   session mirrors the one in your screenshots
3. A one-line pointer to the persona to try first — usually **Reviewer** for a
   controls-gap check on an uploaded doc, or **Drafter** for a from-scratch
   policy

## Caveats to flag up-front

The preview is not production. Say so explicitly so the prospect doesn't bench
it against enterprise expectations:

- The cognition / evidence store is **in-memory** and resets between sessions —
  anything they upload will disappear.
- All requests run under a shared `PREVIEW_ORG_ID = "preview"` tenant; there is
  no auth or isolation yet.
- Framework coverage is the seeded subset (SOC 2 CC, GDPR core, EU AI Act core,
  ISO 27001 core) — not every sub-control is wired.

## Suggested message template

> Glad it clicked! Attaching the two source files I loaded into the demo
> matter — the regulatory-authority guidance and the sample offering memo.
> Heads up: the preview runs against our seeded SOC 2 / GDPR / EU AI Act /
> ISO 27001 catalogs, and the cognition store resets between sessions, so
> anything you upload won't persist yet. Try dropping the files into a fresh
> matter and asking the Reviewer persona for a controls gap-check. Keen to
> hear what you think.
