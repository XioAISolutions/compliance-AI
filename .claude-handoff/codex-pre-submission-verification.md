# Codex handoff — pre-submission verification (GO/NO-GO gate)

**Authored by:** Claude (1M-context Opus 4.7)
**Created:** 2026-05-05
**Branch:** `feat/amd-mi300x-vllm` · head `379f699` or newer · release tag `v1.0.0-amd-hackathon-submission`
**PR:** https://github.com/XioAISolutions/compliance-AI/pull/56
**Submission deadline:** 2026-05-10

---

## Goal

Run a full pre-submission verification pass and produce a **single GO/NO-GO signal** for the human, plus the exact remaining clicks they need to do.

Unlike the previous handoff (`codex-final-deploy-and-demo.md`), this one is **not about producing artifacts** — every artifact is shipped. This is about catching drift, confirming nothing regressed in the day or two between work-finish and submission, and walking the human through the final 6 manual steps on submission day.

If anything fails, **STOP** and return a NO-GO with the specific failure. Do not ship a fix without the human's confirmation — at this stage, "doing nothing" is safer than "fixing one more thing."

---

## What's already shipped (do not re-do)

### Commits ahead of `a176921` ("5 P1 fixes" head)

```
1ae50f0  chore(license,readme): add Apache-2.0 LICENSE + 6 README badges
5c737a5  docs(submission): inline audit-chain screenshot + concrete post paths
8214fb4  docs(amd): embed ensemble-shape screenshot + 2 viz items
a0d614b  docs(readme): embed One-answer-vs-Triad screenshot above the fold
90105df  chore(hackathon): delete stale pitch-deck.md duplicate
d6042c2  docs(submission): demo video + narration + screenshots + Codex handoff
8e260eb  docs(posts): refresh build-in-public image attachments for new panels
e59fd4a  docs(readme): sync 90-second demo path with the new panels
c3b5193  docs(hackathon): document the 4 new submission-day surfaces
9d2a6d6  feat(hackathon): submission-day rubric-targeted polish — 4 surfaces
```

### Four submission-day panels

| Surface                             | What                                                                   | Rubric                       |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| `/demo/judge` (top)                 | "One answer vs Triad" comparison                                       | Originality                  |
| `/demo/judge` (in approval gate)    | Inline audit chain — 6 hash-linked rows                                | Originality + Business Value |
| `/demo/debate` (below ProviderBar)  | Ensemble shape panel — voice dots → vLLM → MI300X with live KV-cache % | Application of Tech          |
| `/` and `/demo/debate` (above hero) | Cold-click "AMD warming" banner                                        | Presentation                 |

### GitHub-side

- ✅ PR #56 description rewritten end-to-end (`gh pr edit`)
- ✅ Repo description, homepage URL, 12 topics applied (`gh repo edit`)
- ✅ Apache-2.0 LICENSE file committed → repo home now shows correct license
- ✅ Release tag `v1.0.0-amd-hackathon-submission` published with `demo-video.mp4` (4.2 MB) and `pitch-deck.marp.pdf` (204 KB) as assets

### Submission artifacts in repo

- `output/hackathon/demo-video.mp4` — 2:15, 1920×1080, H.264, 4.0 MB
- `output/hackathon/demo-video-narration.txt` — full narration script
- `output/hackathon/video/*.png` — 12 screenshots (covering every shot in the shot list)
- `output/hackathon/pitch-deck.marp.{md,pdf}` — current Triad framing, PDF re-rendered
- `output/hackathon/post-1-the-diff.md` — 3 build-in-public posts with concrete screenshot file paths

### Submission copy paste-ready (gitignored)

`.local-hackathon-notes.md` — title (47 char), summary (250 char), long description (249 words), tracks, tech stack tags, all five submission URLs. Verified gitignored at `.gitignore` line 16.

---

## Task — verification gate (run all of these)

Each check is a single command that exits non-zero on failure. Codex's job is to run every one and report results.

### Check 1 — Working tree clean, branch in sync

```bash
cd /Users/slavaz/compliance-AI
git fetch origin --quiet
git status -sb
git log --oneline -5
```

**Expected:**

- `## feat/amd-mi300x-vllm...origin/feat/amd-mi300x-vllm` (no `[ahead N]`/`[behind M]`)
- No untracked / modified files except possibly `.local-hackathon-notes.md` (gitignored, may have local YouTube URL pasted)
- Top of log shows `379f699` or a newer polish commit as the most recent commit

**Fail handling:** If working tree is dirty with anything except `.local-hackathon-notes.md`, stop and report. If branch is behind origin, the human pulled work from another machine — pull and re-verify from there.

### Check 2 — Local tests / lint / typecheck still green

```bash
cd /Users/slavaz/compliance-AI
pnpm test 2>&1 | tail -5
pnpm lint 2>&1 | tail -3
pnpm typecheck 2>&1 | tail -3
```

**Expected:**

- `Tests  363 passed | 1 skipped (364)` — exact match
- `lint` exits 0 with no eslint output
- `typecheck` shows `Tasks: 9 successful, 9 total`

**Fail handling:** Any regression here is a hard NO-GO. Do not ship a fix without human confirmation; report and stop.

### Check 3 — Live URL serving the four new panels

```bash
URL="https://compliance-ai-amd-demo-production.up.railway.app"

# /demo/judge — should match all four markers
curl -fs --max-time 10 "$URL/demo/judge" \
  | grep -oE "(What XIO Triad found|Show audit chain|Both took the same input|What it.s missing)" \
  | sort -u

# /demo/debate — should match three markers
curl -fs --max-time 10 "$URL/demo/debate" \
  | grep -oE "(Ensemble shape|192 GB HBM3|Triad Review · live debate)" \
  | sort -u
```

**Expected:**

- /demo/judge: at least 3 of the 4 markers (the `Both took the same input` tagline is rendered text and should appear; `What XIO Triad found` and `Show audit chain` both definitively confirmed in earlier probes)
- /demo/debate: all 3 markers

**Fail handling:** If the live URL doesn't show the new markers, the deploy reverted or Railway is serving cached HTML. Investigate via Railway dashboard before any code changes.

### Check 4 — AMD endpoint healthy

```bash
curl -fs --max-time 10 https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck/llm | jq '{ok, provider, latencyMs, model: .model, ctx: .modelInfo.maxContextTokens}'
```

**Expected:**

```json
{
  "ok": true,
  "provider": "amd_vllm",
  "latencyMs": 100-500,
  "model": "Qwen/Qwen2.5-72B-Instruct",
  "ctx": 32768
}
```

**Fail handling:** If `ok: false`, the AMD droplet is offline. Submission can still proceed because:

- `/demo/judge` is statically prerendered — works without the GPU
- The cold-click warming banner activates on `/` and `/demo/debate`
- The "view sample" path on `/demo/debate` works offline

But before clicking submit on lablab, the human should warm the droplet (see Step 4 of the human checklist below) so judges hitting the live URL right after submission see the live ensemble panel light up.

### Check 5 — Full E2E smoke against live URL

```bash
cd /Users/slavaz/compliance-AI
DEMO_BASE_URL=https://compliance-ai-amd-demo-production.up.railway.app pnpm smoke:demo 2>&1 | tail -20
```

**Expected:** Final line `demo smoke passed for https://compliance-ai-amd-demo-production.up.railway.app`. All 13 endpoints return 200.

**Fail handling:** If any endpoint fails, investigate via the path. The most likely failure is `/api/quick-review` if the document parser hits a transient error — re-run once before reporting.

### Check 6 — Submission copy character counts

````bash
cd /Users/slavaz/compliance-AI

# Title (limit 50)
TITLE="XIO Compliance Brain — Triad Review on MI300X"
printf '%s\n' "$TITLE" | awk '{ printf "TITLE chars: %d / 50\n", length }'

# Summary (limit 255)
SUMMARY=$(awk '/^### Tagline/,/^### Tracks/' .local-hackathon-notes.md \
  | sed -n '/^```/,/^```/p' | sed '1d;$d')
printf '%s\n' "$SUMMARY" | awk '{ printf "SUMMARY chars: %d / 255\n", length }'

# Long description word count (need ≥100)
awk '/^### Long description/,/^### How does it scale/' .local-hackathon-notes.md \
  | sed -n '/^```/,/^```/p' | sed '1d;$d' \
  | wc -w | awk '{ printf "LONG DESC words: %d / 100 minimum\n", $1 }'
````

**Expected:**

- TITLE chars: 47 / 50
- SUMMARY chars: 250 / 255
- LONG DESC words: 249 / 100 minimum

**Fail handling:** If any field is over its limit, the human edited `.local-hackathon-notes.md` and broke a count. Report the over-limit count.

### Check 7 — GitHub repo + PR + release state

```bash
cd /Users/slavaz/compliance-AI

# Repo metadata is set
gh repo view XioAISolutions/compliance-AI --json description,homepageUrl,licenseInfo,repositoryTopics 2>&1

# PR #56 has the new framing (≥5 of these strings)
gh pr view 56 --json body --jq '.body' \
  | grep -cE "Triad Review Engine|Counsel · Risk · Evidence|One answer vs Triad|ensemble shape panel|inline audit chain|cold-click warming"

# Release exists with both assets
gh release view v1.0.0-amd-hackathon-submission \
  --json tagName,assets --jq '{tag:.tagName, assets:[.assets[].name]}'
```

**Expected:**

- Repo description starts with "Triad Review Engine for audit-ready compliance work"
- Homepage URL is the `/demo/judge` link
- License is `Apache-2.0`
- ≥12 topics including `amd-mi300x`, `agentic-workflows`, `hackathon`, `lablab`
- PR body match count: 6 (or close to it)
- Release has `demo-video.mp4` and `pitch-deck.marp.pdf` as assets

**Fail handling:** Any missing piece is a polish gap. Report it; the human can fix in seconds with `gh repo edit`, `gh pr edit`, or `gh release edit`.

### Check 8 — Demo video file integrity

```bash
ffprobe -v error -show_entries format=duration,size,bit_rate \
  -show_entries stream=codec_name,width,height \
  -of default=noprint_wrappers=1 \
  /Users/slavaz/compliance-AI/output/hackathon/demo-video.mp4
```

**Expected:**

- `duration=135.000000` (2:15)
- `width=1920`, `height=1080`
- `codec_name=h264`

**Fail handling:** If the file is missing or corrupted, fall back to the release asset:

```bash
curl -fLO https://github.com/XioAISolutions/compliance-AI/releases/download/v1.0.0-amd-hackathon-submission/demo-video.mp4
```

---

## After verification — produce a single GO/NO-GO

When all 8 checks pass, output:

```
✅ GO — submission ready

Pre-submission verification: 8/8 PASSED
- Working tree: clean, branch in sync
- Tests: 363 passing
- Lint + typecheck: clean
- Live URL: all 4 new panels serving correctly
- AMD endpoint: ok, <N>ms ping
- E2E smoke: 13/13 endpoints
- Char counts: title 47/50 · summary 250/255 · long desc 249w
- GitHub repo + PR + release: complete

Proceed with the 6 human-only steps below.
```

When anything fails, output:

```
🛑 NO-GO — verification failed

Failed check: <number and name>
What went wrong: <specific symptom>
Suggested next step: <single concrete action>

Do NOT proceed with submission until this is resolved.
```

---

## The 6 human-only submission-day steps

(Codex coaches the human through these. Codex cannot do them autonomously without YouTube/lablab credentials.)

### Step 1 — Upload demo video to YouTube unlisted

```
File: /Users/slavaz/compliance-AI/output/hackathon/demo-video.mp4
       (or grab from the GitHub release if the local file got moved)

Open: https://www.youtube.com/upload (logged into the channel that should host it)

Settings:
  Title:      XIO Compliance Brain — Triad Review on AMD MI300X (Hackathon Demo)
  Description: see /tmp/youtube-description.txt below — copy from there
  Visibility: Unlisted
  Audience:   "Not made for kids"
  Comments:   off (optional, prevents drive-by spam)
  Category:   Science & Technology

Save → copy share URL (https://youtu.be/xxxx)
```

Suggested YouTube description (Codex: write this to `/tmp/youtube-description.txt` so the human can copy-paste):

```
XIO Compliance Brain — Triad Review Engine for audit-ready compliance work.

Three AI reviewers — Counsel, Risk, and Evidence — critique the same matter
in parallel on a single AMD Instinct MI300X running Qwen 2.5 72B via vLLM.
Synthesis turns three perspectives into one decision-grade verdict; optional
Round 2 has voices defend, update, or concede their stance.

Built for the AMD × lablab.ai Developer Hackathon (May 2026).
Tracks: AI Agents & Agentic Workflows · Build in Public.

Live demo: https://compliance-ai-amd-demo-production.up.railway.app/demo/judge
Source:    https://github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm
Release:   https://github.com/XioAISolutions/compliance-AI/releases/tag/v1.0.0-amd-hackathon-submission

#AMDDevHackathon #lablabai
```

### Step 2 — Paste YouTube URL into the local notes

```bash
# Open the file
$EDITOR /Users/slavaz/compliance-AI/.local-hackathon-notes.md

# In the "Submission URLs" table, replace the "Demo video" row's value
# with the YouTube URL from Step 1.
```

### Step 3 — Paste copy into the lablab.ai submission form

Open both side-by-side:

- The lablab submission form for the AMD × lablab.ai hackathon
- `.local-hackathon-notes.md`

Copy each field from the "lablab.ai submission form — paste-ready" section in the notes file and paste into the form. **Save as draft** — do not submit yet.

Fields:

- Title
- Tagline / short summary
- Long description
- Tracks (multi-select)
- Tech stack tags
- Live URL
- Source URL
- Demo video URL (from Step 1)
- Pitch deck URL (use the GitHub release asset URL: `https://github.com/XioAISolutions/compliance-AI/releases/download/v1.0.0-amd-hackathon-submission/pitch-deck.marp.pdf`)

### Step 4 — Warm the AMD droplet 15-30 min before submission deadline

```bash
ssh amd-droplet
docker logs -f vllm-qwen72b   # confirm container is up + serving
```

If droplet was stopped: it auto-restarts the vllm-qwen72b container on boot. Verify with:

```bash
curl https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck/llm | jq .ok
```

Should return `true`. Latency should be <500 ms.

### Step 5 — Make the repo public (submission day only)

```bash
gh repo edit XioAISolutions/compliance-AI --visibility public --accept-visibility-change-consequences
```

Verify:

```bash
gh repo view XioAISolutions/compliance-AI --json visibility --jq '.visibility'
# Should print: public
```

### Step 6 — Click Submit on the lablab form

After Steps 1-5 are done and the verification gate is GO, hit Submit on the lablab form.

### Optional — schedule the 3 build-in-public posts

The cadence is in `output/hackathon/post-1-the-diff.md` (gitignored: posts file is committed; image-attach paths are concrete file paths now). Recommendation:

- Post 1 — the night before submission day OR immediately after the lablab form is filed
- Post 2 — submission day +1, attaching `output/hackathon/video/debate-running.png` or a recorded GIF
- Post 3 — submission day +2, attaching `output/hackathon/video/judge-audit-chain.png`

All three carry `#AMDDevHackathon` `#lablabai` to qualify for the Build in Public track bonus.

---

## What Codex must NOT do

- ❌ Ship code fixes without human confirmation. The submission window is too narrow for "one more change broke something" cycles.
- ❌ Run `pnpm install` or update `pnpm-lock.yaml`. The lockfile is intentionally pinned.
- ❌ Touch the legacy `main` branch.
- ❌ Make the repo public until the human says so. Premature visibility gives competitors a heads-up.
- ❌ Click Submit on the lablab form. The human controls that final action.
- ❌ Upload to YouTube without YouTube credentials — fall back to coaching the human through the manual upload.
- ❌ Modify any of the four new panels (cold-click banner, ensemble shape, one-answer-vs-Triad, audit chain). They've been verified rendering on live URL.

---

## Acceptance criteria — Codex is done when

1. ✅ All 8 verification checks pass (or any failures are reported and human-acknowledged)
2. ✅ A single GO/NO-GO signal has been delivered
3. ✅ `/tmp/youtube-description.txt` has been written for the human to paste
4. ✅ The 6 human-only steps are listed clearly with their exact commands

If GO is achieved, Codex's job is done. The human takes Steps 1-6.
If NO-GO, Codex stops and waits for human confirmation before any remediation.

---

## References

- This handoff: `.claude-handoff/codex-pre-submission-verification.md`
- Previous handoff (deploy + video production): `.claude-handoff/codex-final-deploy-and-demo.md`
- Claude's plan that drove the work: `/Users/slavaz/.claude/plans/plugin-dev-agent-development-see-our-rustling-boole.md`
- Submission copy + checklist: `.local-hackathon-notes.md` (gitignored)
- Submission doc: `HACKATHON_SUBMISSION.md`
- AMD technical brief: `AMD_HACKATHON.md`
- Pitch deck source: `output/hackathon/pitch-deck.marp.md`
- Pitch deck PDF: `output/hackathon/pitch-deck.marp.pdf`
- Demo video: `output/hackathon/demo-video.mp4` (also at the v1.0.0 release)
- Demo screenshots: `output/hackathon/video/*.png` (12 files)
- Build-in-public posts: `output/hackathon/post-1-the-diff.md`
- License: `LICENSE` (Apache-2.0)
- PR #56: https://github.com/XioAISolutions/compliance-AI/pull/56
- Release: https://github.com/XioAISolutions/compliance-AI/releases/tag/v1.0.0-amd-hackathon-submission
- Live URL: https://compliance-ai-amd-demo-production.up.railway.app
- 90-second judge demo: https://compliance-ai-amd-demo-production.up.railway.app/demo/judge

`#AMDDevHackathon` · `#lablabai`
