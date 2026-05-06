# Deploying this Space to Hugging Face

This Space targets the AMD × lablab.ai Developer Hackathon — specifically
the Hugging Face track ($200 HF credits + 2 months HF PRO + most-likes
sub-prize) and the event organisation
[`lablab-ai-amd-developer-hackathon`](https://huggingface.co/lablab-ai-amd-developer-hackathon).

There are two paths to ship it. Pick whichever fits your HF auth setup.

## Path A — One-shot via `huggingface-cli` (recommended)

```bash
# 1. Authenticate (one-time)
pip install --upgrade huggingface_hub
huggingface-cli login   # paste a token with WRITE access from
                        # https://huggingface.co/settings/tokens

# 2. Pick a Space name. Suggested:
SPACE="<your-username>/xio-compliance-brain-triad-review"
# e.g. "slavazeph/xio-compliance-brain-triad-review"
# or, if you have access to the event org:
# SPACE="lablab-ai-amd-developer-hackathon/xio-compliance-brain-triad-review"

# 3. Create the Space (one-time)
huggingface-cli repo create "$SPACE" --type space --space_sdk gradio

# 4. Push. From the repo root (parent of apps/):
cd apps/space
huggingface-cli upload "$SPACE" . . \
  --repo-type space \
  --commit-message "Initial commit — XIO Compliance Brain Triad Review (AMD MI300X)"

# 5. The Space will build for ~1-2 min, then live at:
#    https://huggingface.co/spaces/$SPACE
```

## Path B — Git-based push (if you prefer)

```bash
# 1. Authenticate (one-time)
huggingface-cli login

# 2. Create the Space in the HF web UI:
#    https://huggingface.co/new-space
#    SDK: Gradio · License: Apache-2.0 · Visibility: Public
#    Suggested name: xio-compliance-brain-triad-review

# 3. Clone the (now-existing) empty Space repo
cd /tmp
git clone https://huggingface.co/spaces/<your-username>/xio-compliance-brain-triad-review
cd xio-compliance-brain-triad-review

# 4. Copy the four files from this repo
cp /Users/slavaz/compliance-AI/apps/space/README.md .
cp /Users/slavaz/compliance-AI/apps/space/app.py .
cp /Users/slavaz/compliance-AI/apps/space/requirements.txt .
cp /Users/slavaz/compliance-AI/apps/space/.gitignore .

# 5. Commit and push
git add .
git commit -m "Initial commit — XIO Compliance Brain Triad Review (AMD MI300X)"
git push
```

## After the Space is live

1. **Add the Space URL to the lablab submission form** — paste in the
   "Demo URL" or "Project URL" field.
2. **Add the Space URL to `.local-hackathon-notes.md`** — the gitignored
   working notes — under Submission URLs.
3. **Apply to join the event organisation** if you want the Space featured:
   visit https://huggingface.co/lablab-ai-amd-developer-hackathon and click
   "Request to join". Once accepted, you can transfer the Space into the
   org via the Space settings (or duplicate it there).
4. **Like your own Space, and post the link** to your hackathon channels —
   the most-likes sub-prize is real, so community-pull matters.

## What this Space contains

- **Tab 1 — 90-second seeded demo**: pre-rendered `/demo/judge` content
  (One-answer-vs-Triad comparison, findings, audit chain). Static, no GPU
  spend. Always works, even when the AMD droplet is stopped.
- **Tab 2 — Live debate**: streams from the Railway-hosted `/api/debate`
  endpoint (AMD MI300X / Qwen 2.5 72B / vLLM). Three voices stream
  concurrently. Falls back gracefully when the droplet is offline.
- **Tab 3 — About / Why MI300X**: the architectural story.

## Checklist before pushing

- [x] `app.py` compiles (`python3 -m py_compile app.py` exits 0)
- [x] `README.md` frontmatter has `sdk: gradio` and `sdk_version: 5.11.0`
- [x] `requirements.txt` pins `gradio>=5.11.0,<6`
- [x] `.gitignore` excludes local `.venv/` directories
- [ ] You have a HF write-access token from
      https://huggingface.co/settings/tokens
- [ ] You've decided whether to publish under your username or the event
      org (org submission may unlock the most-likes sub-prize directly)

## Troubleshooting

**"403" or "401" pushing to HF**: re-run `huggingface-cli login` with a
WRITE-access token (the default is READ-access only).

**Space build fails with `ModuleNotFoundError`**: check the build logs at
`https://huggingface.co/spaces/<your-username>/<space-name>/logs`. The
Space rebuilds from `requirements.txt` on every push.

**Live debate tab returns "endpoint unreachable"**: the AMD droplet at
the Railway preview is intentionally cycled between demos. The seeded tab
always works.
