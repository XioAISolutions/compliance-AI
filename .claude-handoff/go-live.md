# 🚀 GO-LIVE prompt — combined human + Codex submission driver

**Authored by:** Claude (1M-context Opus 4.7)
**Created:** 2026-05-05
**Branch:** `feat/amd-mi300x-vllm` (head `28c4d1a` or newer)
**Release:** `v1.0.0-amd-hackathon-submission`
**PR:** https://github.com/XioAISolutions/compliance-AI/pull/56
**Submission deadline:** 2026-05-10

This is the single end-to-end driver for getting the XIO Compliance Brain submitted to the AMD × lablab.ai Developer Hackathon with every confirmed bonus track engaged. Read top to bottom; do not skip phases.

Roles in this handoff:

- **Codex** — runs shell commands locally on `/Users/slavaz/compliance-AI`. Cannot do HF / YouTube / lablab auth.
- **Human** — does anything that needs auth (HF, YouTube, lablab, GitHub repo visibility) and clicks Submit.

If you are Codex CLI, **read this whole file once before doing anything**, then start at Phase 1.

---

## Bonus tracks targeted (status legend)

| Track                               | Reward                            | Status                                                   |
| ----------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Main hackathon submission           | $21,500+ pool · MI300X GPU prize  | ✅ Code shipped, ⏳ form not yet submitted               |
| Hugging Face track                  | $200 HF Credits + 2 months HF PRO | ✅ Space + Dataset code shipped, ⏳ not yet pushed to HF |
| HF Most-Likes sub-prize             | Sub-prize                         | ⏳ Same Space push, plus rally                           |
| Build in Public track               | Dedicated prize pool              | ✅ 3 posts drafted, ⏳ not yet posted                    |
| lablab.ai gallery + community votes | Discoverability + voting          | ⏳ Auto-populated when form is submitted                 |

---

## Phase 1 — Pre-flight verification (Codex)

Run all 8 checks from `.claude-handoff/codex-pre-submission-verification.md` and produce a single GO/NO-GO. **Do not proceed to Phase 2 unless GO.**

```bash
cd /Users/slavaz/compliance-AI
git fetch origin --quiet
git pull --ff-only origin feat/amd-mi300x-vllm
cat .claude-handoff/codex-pre-submission-verification.md  # read the 8 checks
```

Then run each check in the file. Save the result to `/tmp/codex-verification-report.md`. If any check fails, STOP and report. Do not ship a fix without human confirmation.

Acceptance: Print the GO/NO-GO summary plus the path to `/tmp/codex-verification-report.md`.

---

## Phase 2 — Push the Hugging Face Space (Codex shell + Human auth)

**Why:** Unlocks the Hugging Face track ($200 credits + 2 months HF PRO) and the most-likes sub-prize.

**One-time auth (HUMAN only):**

```bash
pip install --upgrade huggingface_hub
huggingface-cli login   # paste a WRITE-access token from
                        # https://huggingface.co/settings/tokens
```

**Push (Codex can run after the human is logged in):**

```bash
# Pick a Space name — replace <USER> with the HF username
SPACE="<USER>/xio-compliance-brain-triad-review"

cd /Users/slavaz/compliance-AI/apps/space

huggingface-cli repo create "$SPACE" --type space --space_sdk gradio
huggingface-cli upload "$SPACE" . . \
  --repo-type space \
  --commit-message "Initial commit — XIO Compliance Brain Triad Review (AMD MI300X)"

echo "Space URL: https://huggingface.co/spaces/$SPACE"
echo "Build logs: https://huggingface.co/spaces/$SPACE/logs"
```

**Verify the Space builds (HUMAN — open the URL):**

The Space takes ~1–2 minutes to build (`pip install gradio`). Open the URL. Confirm:

- Header pill says "✅ AMD endpoint live …" or "🟡 AMD droplet warming …"
- Tab 1 "90-second seeded demo" renders the One-answer-vs-Triad story, findings, audit chain
- Tab 2 "Live debate · AMD MI300X" has a prompt box and Run button (will fail gracefully if AMD is offline)
- Tab 3 "About / Why MI300X" has the architecture diagram

**Apply to join the event org (HUMAN — one click):**

Visit https://huggingface.co/lablab-ai-amd-developer-hackathon → "Request to join" button. Once accepted, you can either transfer the Space or duplicate it into the org via Space settings.

Detailed steps + troubleshooting in `apps/space/DEPLOY.md`.

---

## Phase 3 — Push the Hugging Face Dataset (Codex shell)

**Why:** Doubles HF surface area (Spaces and datasets are separate search indexes). Reusable artefact for anyone replicating the Triad pattern.

```bash
DATASET="<USER>/xio-compliance-brain-triad-prompts"

cd /Users/slavaz/compliance-AI/apps/dataset

huggingface-cli repo create "$DATASET" --type dataset
huggingface-cli upload "$DATASET" . . \
  --repo-type dataset \
  --commit-message "Initial commit — Triad reviewer prompts (XIO Compliance Brain)"

echo "Dataset URL: https://huggingface.co/datasets/$DATASET"
```

**Verify (Codex):**

```bash
# Sanity load via datasets library (may need: pip install datasets)
python3 -c "
from datasets import load_dataset
prompts = load_dataset('$DATASET', 'prompts')
examples = load_dataset('$DATASET', 'examples')
print('prompts rows:', len(prompts['train']))
print('examples rows:', len(examples['train']))
print('first prompt role:', prompts['train'][0]['role'])
"
```

Expected output:

```
prompts rows: 4
examples rows: 1
first prompt role: base
```

Detailed steps + troubleshooting in `apps/dataset/DEPLOY.md`.

---

## Phase 4 — Upload demo video to YouTube (Human only)

**Why:** lablab submission form requires a video URL.

The local file `output/hackathon/demo-video.mp4` is 4.2 MB · 2:15 · 1920×1080 · H.264. Codex verified it as a valid MP4 in commit `aa46c5b`. Same file is also attached to the v1.0.0 release on GitHub.

```
1. Open https://www.youtube.com/upload (logged into your channel)
2. Drag-and-drop /Users/slavaz/compliance-AI/output/hackathon/demo-video.mp4
3. Title:       XIO Compliance Brain — Triad Review on AMD MI300X (Hackathon Demo)
   Description: see /tmp/youtube-description.txt (Codex writes this in Phase 1)
   Visibility:  Unlisted
   Audience:    Not made for kids
   Category:    Science & Technology
4. Save → copy share URL (https://youtu.be/xxxx)
```

If `/tmp/youtube-description.txt` doesn't exist yet, Codex should write it now:

```bash
cat > /tmp/youtube-description.txt <<'EOF'
XIO Compliance Brain — Triad Review Engine for audit-ready compliance work.

Three AI reviewers — Counsel, Risk, and Evidence — critique the same matter
in parallel on a single AMD Instinct MI300X running Qwen 2.5 72B via vLLM.
Synthesis turns three perspectives into one decision-grade verdict; optional
Round 2 has voices defend, update, or concede their stance.

Built for the AMD × lablab.ai Developer Hackathon (May 2026).
Tracks: AI Agents & Agentic Workflows · Build in Public.

Live demo:    https://compliance-ai-amd-demo-production.up.railway.app/demo/judge
HF Space:     https://huggingface.co/spaces/<USER>/xio-compliance-brain-triad-review
HF Dataset:   https://huggingface.co/datasets/<USER>/xio-compliance-brain-triad-prompts
Source:       https://github.com/XioAISolutions/compliance-AI/pull/56
Release:      https://github.com/XioAISolutions/compliance-AI/releases/tag/v1.0.0-amd-hackathon-submission

#AMDDevHackathon #lablabai
EOF
```

After upload, replace `<USER>` placeholders with the actual HF username.

---

## Phase 5 — Wire the URLs into the local notes (Human edits one file)

```bash
$EDITOR /Users/slavaz/compliance-AI/.local-hackathon-notes.md
```

In the "Submission URLs" table, fill in:

- **Demo video** — paste the YouTube URL from Phase 4
- **HF Space** (add a new row if absent) — `https://huggingface.co/spaces/<USER>/xio-compliance-brain-triad-review`
- **HF Dataset** (add a new row if absent) — `https://huggingface.co/datasets/<USER>/xio-compliance-brain-triad-prompts`

The notes file is gitignored — local edits never get committed.

---

## Phase 6 — Final smoke + verification (Codex)

After the HF artefacts are live and YouTube URL is in the notes file, run the verification gate one more time and confirm everything still passes.

```bash
cd /Users/slavaz/compliance-AI

# Re-run the 8 checks from Phase 1
# Plus three new HF checks:

# Check 9 — HF Space loads (sniff for Gradio)
SPACE="<USER>/xio-compliance-brain-triad-review"
curl -fs --max-time 10 "https://huggingface.co/spaces/$SPACE" | head -c 200
# Should return HTML containing "huggingface" and "<title>"

# Check 10 — HF Dataset is browsable
DATASET="<USER>/xio-compliance-brain-triad-prompts"
curl -fs --max-time 10 "https://huggingface.co/datasets/$DATASET" | head -c 200
# Should return HTML containing the dataset name

# Check 11 — Submission notes have the YouTube URL filled
grep -q "https://youtu.be/\|https://www.youtube.com/watch" /Users/slavaz/compliance-AI/.local-hackathon-notes.md \
  && echo "✅ YouTube URL is in notes" \
  || echo "❌ YouTube URL missing — Phase 5 not done"

# Check 12 — AMD endpoint warm (within 30 min of deadline)
curl -fs --max-time 10 https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck/llm \
  | jq '.ok'
# Should print true
```

Acceptance: Print final GO/NO-GO. If GO, proceed to Phase 7. If NO-GO, stop.

---

## Phase 7 — Submission-day clicks (Human only · order matters)

**On May 10 (or earlier as a draft):**

```
A. Open the lablab submission form for the AMD × lablab.ai hackathon.

B. Open .local-hackathon-notes.md alongside it.

C. Copy/paste each field from the "lablab.ai submission form — paste-ready" section:
   - Title (47 chars)
   - Tagline / short summary (250 chars)
   - Long description (≥230 words)
   - Tracks: AI Agents & Agentic Workflows · Build in Public
   - Tech stack tags
   - Live URL                — https://compliance-ai-amd-demo-production.up.railway.app
   - 90-second judge demo    — https://compliance-ai-amd-demo-production.up.railway.app/demo/judge
   - Demo video URL          — YouTube link from Phase 4
   - HF Space URL            — from Phase 2
   - HF Dataset URL          — from Phase 3
   - Source URL              — https://github.com/XioAISolutions/compliance-AI/pull/56
                                (or after Step F, the public repo URL)
   - Pitch deck URL          — https://github.com/XioAISolutions/compliance-AI/releases/download/v1.0.0-amd-hackathon-submission/pitch-deck.marp.pdf

D. Save as draft. Sanity-watch the demo video once start-to-finish from
   the unlisted YouTube link to confirm audio + visuals.

E. Warm the AMD droplet 30 min before deadline:
       ssh amd-droplet
       docker logs -f vllm-qwen72b   # confirm container is up
   Then verify from the laptop:
       curl -fs https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck/llm \
         | jq '.ok'   # should print true

F. Make the repo public:
       gh repo edit XioAISolutions/compliance-AI \
         --visibility public --accept-visibility-change-consequences
       gh repo view XioAISolutions/compliance-AI --json visibility --jq '.visibility'
       # should print: public

G. Click Submit on the lablab form.

H. Verify your project appears in the lablab.ai gallery at
   https://lablab.ai/apps (search for "XIO Compliance Brain").
```

**Right after Submit (within 1 hour):**

```
I. Post Build-in-public Post #1 (file: output/hackathon/post-1-the-diff.md
   first block). Attach screenshot output/hackathon/video/judge-comparison.png.
   Hashtags: #AMDDevHackathon #lablabai

J. Like the HF Space (and ask a few teammates to like it too) — the
   most-likes sub-prize is real, voting matters.
```

**Day +1:**

```
K. Post Build-in-public Post #2 ("Why three reviewers, not one").
   Attach the screen recording or the still
   output/hackathon/video/debate-running.png.
```

**Day +2:**

```
L. Post Build-in-public Post #3 ("the receipt").
   Attach output/hackathon/video/judge-audit-chain.png.
```

---

## Hard rules for Codex (carry forward from previous handoffs)

- ❌ Do NOT make code changes during this submission window.
- ❌ Do NOT run `pnpm install` or modify `pnpm-lock.yaml`.
- ❌ Do NOT touch the `main` branch.
- ❌ Do NOT make the repo public — Step F is for the human only.
- ❌ Do NOT click Submit on the lablab form.
- ❌ Do NOT upload to YouTube without human credentials — fall back to coaching the human through the manual upload (Phase 4).

If a verification check fails, **STOP** and report. Do not ship a fix; the submission window is too narrow for "one more change broke something."

---

## Reference docs (everything else lives in these)

- **Pre-submission verification gate (8 checks):** `.claude-handoff/codex-pre-submission-verification.md`
- **Demo + deploy handoff:** `.claude-handoff/codex-final-deploy-and-demo.md`
- **Original plan:** `/Users/slavaz/.claude/plans/plugin-dev-agent-development-see-our-rustling-boole.md`
- **Submission copy + checklist:** `.local-hackathon-notes.md` (gitignored)
- **Submission doc:** `HACKATHON_SUBMISSION.md`
- **AMD technical brief:** `AMD_HACKATHON.md`
- **Pitch deck source + PDF:** `output/hackathon/pitch-deck.marp.{md,pdf}`
- **Demo video:** `output/hackathon/demo-video.mp4` (also at the v1.0.0 release)
- **12 screenshots:** `output/hackathon/video/*.png`
- **3 build-in-public posts:** `output/hackathon/post-1-the-diff.md`
- **HF Space deploy:** `apps/space/DEPLOY.md`
- **HF Dataset deploy:** `apps/dataset/DEPLOY.md`
- **License:** `LICENSE` (Apache-2.0)
- **PR #56:** https://github.com/XioAISolutions/compliance-AI/pull/56
- **Release:** https://github.com/XioAISolutions/compliance-AI/releases/tag/v1.0.0-amd-hackathon-submission
- **Live URL:** https://compliance-ai-amd-demo-production.up.railway.app
- **Event HF org:** https://huggingface.co/lablab-ai-amd-developer-hackathon
- **lablab hackathon page:** https://lablab.ai/ai-hackathons/amd-developer

`#AMDDevHackathon` `#lablabai`
