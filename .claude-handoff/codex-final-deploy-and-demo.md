# Codex handoff — final deploy verification + demo video

**Authored by:** Claude (1M-context Opus 4.7)
**Created:** 2026-05-05
**Branch:** `feat/amd-mi300x-vllm`
**PR:** https://github.com/XioAISolutions/compliance-AI/pull/56
**Submission deadline:** 2026-05-10

---

## Goal

Pick up where Claude left off. Two tasks, in order:

1. **Verify the Railway deploy actually shipped** the four new submission-day panels to `https://compliance-ai-amd-demo-production.up.railway.app`. As of the last probe, the live HTML did **not** contain the new panel text — see the "Open question" at the bottom of this file.
2. **Produce the 3-minute demo video** that the lablab submission form requires. The shot list is already updated; the live URL must be confirmed working before recording.

This handoff is the final piece of submission readiness. Once both tasks are done and the lablab form is filled, the project is ready to submit.

---

## Current state (as of handoff)

### Commits ahead of `a176921` (Claude's previous head)

```
8e260eb  docs(posts): refresh build-in-public image attachments for new panels
e59fd4a  docs(readme): sync 90-second demo path with the new panels
c3b5193  docs(hackathon): document the 4 new submission-day surfaces
9d2a6d6  feat(hackathon): submission-day rubric-targeted polish — 4 surfaces
a176921  ← previous head (the "5 P1 fixes" cleanup)
```

All four commits are pushed to origin. Working tree is clean.

### What the four new panels do

| Surface                              | What lands there                                                                                                                     | Rubric criterion             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `/demo/judge` (top of page)          | "One answer vs Triad" comparison — left column shows what a generic legal-AI tool would say, right column shows what the Triad found | Originality                  |
| `/demo/judge` (inside approval gate) | Inline audit-chain disclosure — 6 hash-linked rows, each `servedBy: amd_vllm/Qwen/Qwen2.5-72B-Instruct`                              | Originality + Business Value |
| `/demo/debate` (below ProviderBar)   | Ensemble shape panel — N voice-dots → vLLM → MI300X icon with live KV-cache %                                                        | Application of Tech          |
| `/` and `/demo/debate` (above hero)  | Cold-click "AMD warming" banner — only renders when `ping?.ok === false`                                                             | Presentation                 |

### Files touched (read-only reference, do not modify)

- `apps/web/src/app/page.tsx` — homepage cold-click banner
- `apps/web/src/app/demo/debate/DebateConsole.tsx` — debate-console banner + `EnsembleShapePanel` + `VoiceDot` + `GpuIcon`
- `apps/web/src/app/demo/judge/page.tsx` — `OneAnswerVsTriadPanel`, `CompareStat`, inline audit-chain `<details>`, `AuditRowLine`, `abbreviateHash`, `abbreviateProvider`
- `apps/web/src/lib/triad-seed.ts` — new `TriadAuditRow` + `TriadGenericAnswer` interfaces, 6-row audit chain seeded for the Ontario OM matter, `genericSingleAnswer` baseline
- `output/hackathon/pitch-deck.marp.{md,pdf}` — deck refreshed (PDF re-rendered, 198 KB → 204 KB)
- `HACKATHON_SUBMISSION.md`, `README.md`, `output/hackathon/post-1-the-diff.md` — doc syncs

### Verified locally (before handoff)

- ✅ 363 tests passing + 1 skipped AMD live smoke (38 files, 0 regressions)
- ✅ Lint clean (`--max-warnings=0`)
- ✅ Typecheck clean across 9 packages
- ✅ Production Next.js build succeeds (`pnpm --filter @compliance-ai/web build`)
- ✅ All routes register including `/demo/judge` (○ static prerendered) and `/demo/debate` (ƒ dynamic)
- ✅ Rate limit (5/hr/IP) wired into `/api/debate` (verified via grep)
- ✅ AMD endpoint live: `ok: true`, 135 ms ping, Qwen 2.5 72B, 32K ctx, 15 tok/s

---

## Task 1 — Verify the deploy

### Open question — likely the first thing to fix

**At handoff time, the live `/demo/judge` HTML did NOT contain the new panel text** (Claude polled for 7+ minutes and saw nothing). `/api/healthcheck` reported uptime 5844 s (~97 min), which suggests the Railway instance has not rolled to the new build.

Possible causes (Codex: check in this order):

1. **Railway build is slow or queued.** With 4 quick pushes, Railway may have cancelled and restarted the build at least once. Check the Railway dashboard for `compliance-ai-amd-demo-production` build status.
2. **Railway build failed.** Read the deploy logs. The local build succeeded (verified with `pnpm --filter @compliance-ai/web build`), so a failure is more likely env-related than code-related.
3. **Auto-deploy is disabled** on this Railway service. If so, trigger manually from the dashboard.
4. **Railway is configured to deploy a different branch.** Check the deploy source. Should be `feat/amd-mi300x-vllm`.

### Verification commands (after deploy lands)

```bash
# 1. New panel text is in the static HTML
curl -fs https://compliance-ai-amd-demo-production.up.railway.app/demo/judge \
  | grep -oE "(One answer vs Triad|What XIO Triad found|Show audit chain|Both took the same input)" \
  | sort -u
# Expected: all 4 strings, one per line

# 2. Ensemble shape panel mounts on /demo/debate (client-rendered, so check the bundle)
curl -fs https://compliance-ai-amd-demo-production.up.railway.app/demo/debate \
  | grep -oE "(Triad Review · live debate cockpit|Counsel, Risk, and Evidence)" \
  | sort -u
# Expected: both strings (page header text — confirms /demo/debate is current)

# 3. Health rollup
curl -fs https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck | jq .
# Expected: status=ok, llmProvider=amd_vllm, configured=true

# 4. Live LLM ping
curl -fs https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck/llm | jq .
# Expected: ok=true, provider=amd_vllm, model=Qwen/Qwen2.5-72B-Instruct,
#           latencyMs<500, modelInfo.maxContextTokens=32768

# 5. Smoke contract (if you have time + the droplet warm)
cd /Users/slavaz/compliance-AI
pnpm smoke:demo --base-url https://compliance-ai-amd-demo-production.up.railway.app
# Expected: all green

# 6. Rate limit still active — issue 6 debate POSTs in <1 hour from one IP
#    (do NOT actually do this in production unless you want to consume the
#    public rate-limit window — read the test instead)
cat apps/web/src/lib/__tests__/rate-limit.test.ts
```

### If the deploy is healthy but a panel doesn't render

- Browser cache — cold-click banner only fires when `ping?.ok === false`; if AMD is up, banner correctly suppresses (this is the design)
- localStorage — `/demo/debate` first-visit auto-sample may pre-populate the page; clear `compliance-ai:debate-visited` to test cold first-time visitor experience
- The `force-static` directive on `/demo/judge` (line 25 of `apps/web/src/app/demo/judge/page.tsx`) means the page is baked at build time. If the build was old, the new text won't appear no matter how many times you reload — only a fresh deploy fixes it.

### If you have to make a fix

The Railway non-negotiables that Claude has held throughout:

- Live URL stays green at all times — never push a broken build
- 363 tests + lint + typecheck must stay green — no regressions
- Rate limit (5/hr/IP) stays in place
- AMD credit budget: ≤ ~$30 of remaining inference spend (don't load-test)
- Do not touch `packages/agents/src/{run,debate,loop}.ts` — those are the working agent runtime
- Do not touch the legacy `main` branch
- Do not introduce new providers (Anthropic, OpenAI, Ollama, AMD vLLM are the only four)

---

## Task 2 — Produce the 3-minute demo video

### What the lablab submission form needs

A single video URL (YouTube unlisted is the convention). The video walks a judge through the live preview in ≤ 3 min. **Without this video the submission cannot be filed.**

### Shot list (already in `.local-hackathon-notes.md`)

> Filmed against the live preview at `https://compliance-ai-amd-demo-production.up.railway.app`. Two-pass capture: first 0:00–1:30 against `/demo/judge` (seeded, no inference cost, won't go down), then 1:30–2:45 against `/demo/debate` on a warm AMD droplet.

| Time          | Surface        | What to show                                                                                                                                      |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0:00–0:10** | Title card     | "XIO Compliance Brain · Triad Review Engine on AMD MI300X"                                                                                        |
| **0:10–0:25** | Homepage       | Hero (Counsel · Risk · Evidence), provider pill (live), result preview card                                                                       |
| **0:25–0:50** | `/demo/judge`  | Scroll past the **One answer vs Triad** panel — read aloud: "single legal-AI tool says fine; Triad found 3 critical gaps"                         |
| **0:50–1:15** | `/demo/judge`  | Findings list — past-performance, use-of-proceeds, jurisdiction-mismatch citation badge                                                           |
| **1:15–1:30** | `/demo/judge`  | **Where reviewers disagreed** panel → final action                                                                                                |
| **1:30–1:45** | `/demo/judge`  | Approval gate (export blocked) → expand **audit chain** → 6 rows hash-linked, all stamped `amd_vllm/Qwen/Qwen2.5-72B-Instruct`                    |
| **1:45–2:30** | `/demo/debate` | Click "Run debate" — show **ensemble shape panel** lighting up (3 voice dots → vLLM → MI300X glow), live tokens/sec pill, voices land in ~25–30 s |
| **2:30–2:45** | `/demo/debate` | Synthesis card → "round 2" checkbox → second batch of inferences with stance pills (defended/updated/conceded)                                    |
| **2:45–3:00** | Terminal/code  | `pnpm test` — 363 tests green. End card: repo + #AMDDevHackathon                                                                                  |

### Three options for actually producing the video

Pick whichever fits your toolchain. Order is from "human-recorded" to "fully scripted."

#### Option A — Human screen recording (recommended for hackathon)

- macOS: QuickTime Player → File → New Screen Recording, OR `cmd+shift+5` for built-in capture
- Window-only mode: capture just the browser window (cleaner edges than full-screen)
- Voice-over: same recording or a separate audio track in iMovie / DaVinci Resolve
- Edit: trim to 2:55–3:00, add the title card and end card from a slide tool (Keynote, Marp HTML, or Canva)
- Upload: YouTube unlisted, paste URL into `.local-hackathon-notes.md` and the lablab form

**Pre-flight:**

1. Warm the AMD droplet 5 min before filming (`ssh amd-droplet`, confirm `vllm-qwen72b` container is up)
2. Clear browser cache and `localStorage` so first-visit auto-sample doesn't fire on `/demo/debate`
3. Have the offline path as a backup: if AMD goes down mid-take, the `view sample` button on `/demo/debate` fires the offline-recorded sample

#### Option B — Scripted Playwright capture (Codex-runnable)

If you prefer a fully scripted path, drive headless Chromium with Playwright and capture frames via the CDP screencast API. Outline:

```bash
cd /Users/slavaz/compliance-AI
pnpm dlx playwright@latest install chromium
mkdir -p output/hackathon/video
```

Then write a script at `scripts/record-demo.mjs` that:

1. Launches Chromium at 1920×1080
2. Navigates to each surface in the shot list with `page.goto()` + `page.waitForLoadState()`
3. Uses `page.evaluate()` to scroll specific elements into view
4. Records via `page.video.start()` (Playwright's built-in WebM recorder) or via `cdpSession.send('Page.startScreencast', ...)` for finer control
5. Stitches with `ffmpeg` and overlays text titles

**Caveat:** Chromium on Railway/AMD won't have audio. You'd need to add narration separately via TTS (`espeak`, `say` on macOS, or a hosted TTS like ElevenLabs). For a hackathon, voice-over is what makes the video human; consider Option A even if you script the video portion.

#### Option C — Slideshow + screen captures stitched with ffmpeg

Take 8–12 still screenshots of each shot-list surface (`/demo/judge` top, `/demo/judge` audit chain expanded, `/demo/debate` mid-stream, etc.). Stitch into a video with timed transitions:

```bash
ffmpeg -framerate 0.4 -i output/hackathon/video/screenshot-%02d.png \
  -c:v libx264 -pix_fmt yuv420p output/hackathon/video/demo-stills.mp4
```

Add narration as a separate audio track. Lower production value than A or B but quickest to produce if the droplet is unreliable.

### Recommended path

**Option A.** A hackathon demo video benefits from a real human voice walking through the UI; it makes the multi-reviewer story land in a way a scripted browser walk-through never quite does. The shot list above is built around that voice-over.

If Option A is blocked (e.g., user is unavailable to record), fall back to **Option B with TTS narration** as a credible AI-generated alternative — and include the Playwright script in the repo (under `scripts/`) as another build-in-public artifact.

### Where the video URL goes once recorded

Edit two places:

1. `.local-hackathon-notes.md` → "Demo video" row of the "Submission URLs" table
2. The lablab.ai submission form → "Demo video" field

Both before May 10.

---

## What Claude has NOT done (and why)

- ❌ **Recorded the demo video.** I have no camera and Option B above wasn't worth shipping a half-baked Playwright script when the human path is so much better. Owner: human or Codex via Option B.
- ❌ **Triggered a Railway redeploy manually.** I pushed and trusted auto-deploy. If it didn't fire, that's the first task.
- ❌ **Filed the lablab submission.** Copy is paste-ready in `.local-hackathon-notes.md`; the human still has to actually paste and click Submit on May 10.
- ❌ **Made the GitHub repo public.** The submission notes flag that as "submission day" via `gh repo edit ... --visibility public`. Don't do this prematurely.

---

## Acceptance criteria — Codex is done when

1. ✅ `curl /demo/judge | grep "One answer vs Triad"` returns the string (deploy verified)
2. ✅ `curl /api/healthcheck` returns `status: ok` with `llmProvider: amd_vllm`
3. ✅ A demo video URL exists (YouTube unlisted) and is pasted into `.local-hackathon-notes.md`
4. ✅ All 4 new panels render correctly in a fresh incognito browser visit (manual eyeball check or Playwright assertion)
5. ✅ `pnpm test && pnpm lint && pnpm typecheck` still pass on `feat/amd-mi300x-vllm` head

---

## References

- This handoff: `.claude-handoff/codex-final-deploy-and-demo.md`
- Claude's plan that drove the work: `/Users/slavaz/.claude/plans/plugin-dev-agent-development-see-our-rustling-boole.md`
- Submission copy + checklist: `.local-hackathon-notes.md` (gitignored)
- Submission doc: `HACKATHON_SUBMISSION.md`
- Pitch deck: `output/hackathon/pitch-deck.marp.pdf`
- Build-in-public posts: `output/hackathon/post-1-the-diff.md`
- AMD technical brief: `AMD_HACKATHON.md`

`#AMDDevHackathon` · `#lablabai`
