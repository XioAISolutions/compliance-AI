/**
 * Embedding adapters for the lesson layer.
 *
 * The sidecar dedup needs a vector representation it can run cosine
 * similarity over. We expose a small Embedder interface so the prod
 * layer can plug in OpenAI / Voyage / Cohere without the sidecar
 * caring; the in-process default is a deterministic token-frequency
 * embedding that gives sensible similarities for tests and offline
 * dev. It is NOT a learned embedding — content with identical token
 * distributions will collide. That's fine for unit tests where we
 * control the corpus; production should use OpenAI by default.
 */

const EMBEDDING_DIM = 256;

export interface Embedder {
  /** Stable identifier so we can detect dimension mismatches across model swaps. */
  readonly id: string;
  /** Vector dimension this embedder emits. */
  readonly dimension: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Cosine similarity between two equal-length vectors. Returns 0 when
 * either norm is zero (avoids NaN propagation into the sidecar's
 * threshold comparison).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Token-frequency hash embedder. Tokenizes the input, mods each token's
 * djb2 hash into [0..dim), accumulates counts, then L2-normalizes. Two
 * pieces of text with overlapping vocabulary land near each other in
 * cosine space; unrelated text is ~orthogonal. Good enough for a
 * sidecar threshold of 0.85 in tests; production should swap in a
 * learned embedder.
 */
export class DeterministicEmbedder implements Embedder {
  readonly id = "deterministic-tf-256";
  readonly dimension = EMBEDDING_DIM;

  async embed(text: string): Promise<number[]> {
    const v = new Array<number>(EMBEDDING_DIM).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return v;
    for (const tok of tokens) {
      const idx = djb2(tok) % EMBEDDING_DIM;
      v[idx] = (v[idx] ?? 0) + 1;
    }
    return l2Normalize(v);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function l2Normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  if (n === 0) return v;
  const inv = 1 / Math.sqrt(n);
  return v.map((x) => x * inv);
}

/**
 * OpenAI-backed embedder using the text-embedding-3-small model.
 * Requires OPENAI_API_KEY. We don't bring a fancy SDK — fetch is
 * enough and keeps the package dependency-free. If the key is missing
 * or the request fails we throw; the caller picks a fallback.
 */
export class OpenAIEmbedder implements Embedder {
  readonly id: string;
  readonly dimension: number;
  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    dimension = 1536,
  ) {
    this.id = `openai:${model}`;
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const out = await this.embedBatch([text]);
    return out[0]!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings HTTP ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return body.data.map((d) => d.embedding);
  }
}

/**
 * Pick the best available embedder from the environment. Honors
 * COGNITION_EMBEDDER=deterministic to force tests/dev off the
 * network even when an API key is in scope.
 */
export function defaultEmbedder(): Embedder {
  const forced = (
    typeof process !== "undefined" ? process.env.COGNITION_EMBEDDER : undefined
  )?.toLowerCase();
  if (forced === "deterministic") return new DeterministicEmbedder();
  const key =
    typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined;
  if (forced === "openai" && !key) {
    throw new Error("COGNITION_EMBEDDER=openai but OPENAI_API_KEY is unset");
  }
  if (key && forced !== "deterministic") return new OpenAIEmbedder(key);
  return new DeterministicEmbedder();
}
