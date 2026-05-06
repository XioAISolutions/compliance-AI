# Deploying this dataset to Hugging Face

Companion to `apps/space/DEPLOY.md` — same auth flow, different repo type
(`dataset` instead of `space`).

## One-shot via `huggingface-cli`

```bash
# 1. Authenticate (one-time — same token works for Space and Dataset)
pip install --upgrade huggingface_hub
huggingface-cli login   # paste a WRITE-access token from
                        # https://huggingface.co/settings/tokens

# 2. Pick a dataset name. Suggested:
DATASET="<your-username>/xio-compliance-brain-triad-prompts"
# e.g. "slavazeph/xio-compliance-brain-triad-prompts"
# or, if you have access to the event org:
# DATASET="lablab-ai-amd-developer-hackathon/xio-compliance-brain-triad-prompts"

# 3. Create the dataset (one-time)
huggingface-cli repo create "$DATASET" --type dataset

# 4. Push. From the repo root:
cd apps/dataset
huggingface-cli upload "$DATASET" . . \
  --repo-type dataset \
  --commit-message "Initial commit — Triad reviewer prompts (XIO Compliance Brain)"

# 5. The dataset will be live immediately at:
#    https://huggingface.co/datasets/$DATASET
```

## What ships in this dataset

- `README.md` — dataset card with YAML frontmatter (license, configs,
  tags including `lablab-ai-amd-developer-hackathon`).
- `prompts.jsonl` — 4 rows: 1 base prompt (OM Reviewer, ~9.5 KB) + 3
  voice suffixes (Counsel, Risk, Evidence). Use the suggested
  `compose_strategy` to assemble per-voice system prompts.
- `examples.jsonl` — 1 row: seeded Ontario OM matter (input) + expected
  Triad output (6 findings, citations, 1 material disagreement, engine
  receipt).

## Verification after push

```bash
# Programmatic load via the datasets library:
python3 -c "
from datasets import load_dataset
prompts = load_dataset('$DATASET', 'prompts')
examples = load_dataset('$DATASET', 'examples')
print('prompts:', len(prompts['train']))
print('examples:', len(examples['train']))
print('first prompt role:', prompts['train'][0]['role'])
"
```

Expected:

```
prompts: 4
examples: 1
first prompt role: base
```

## After the dataset is live

1. **Link it from the Space's README** so judges discover both. The
   `apps/space/README.md` already references the source repo; add the
   dataset URL alongside.
2. **Add the dataset URL to `.local-hackathon-notes.md`** under the
   "Submission URLs" section so the lablab form references both
   artefacts.
3. **Apply to join the event org** at
   https://huggingface.co/lablab-ai-amd-developer-hackathon (same as the
   Space).

## Why ship a separate dataset (not just bundle inside the Space)

- **Discoverability** — datasets and Spaces appear in different HF
  search indexes. Shipping both doubles the surface area.
- **Reusability** — the prompts are the most concretely reusable
  artefact in the project. Anyone replicating "three-voice debate on
  one model" can grab them directly.
- **Build-in-public** — the dataset card is itself a build-in-public
  artefact: it documents the prompt design choices for future
  contributors.

## Troubleshooting

- **`load_dataset` returns one row instead of N**: the YAML frontmatter
  in `README.md` has `configs:` defined to make `prompts` and
  `examples` two separate configs. If a tool only sees one config,
  pass `--config_name` explicitly: `load_dataset(name, "prompts")`.
- **Dataset card preview is blank on the HF UI**: HF caches dataset
  card renders for ~10 min. Refresh after a short wait.
