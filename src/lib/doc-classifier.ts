import { Ollama } from "ollama";
import { config } from "./config";
import { DOC_TYPES, type DocType } from "./retrieval-filter";

/**
 * Doc-type classifier.
 *
 * Called from the upload route before `ingestPDF` so the chunks land with
 * the correct `docType`. We try cheap deterministic rules first (filename
 * and header heuristics) and only fall back to the chat model when rules
 * say "unknown" or confidence is low.
 *
 * The classifier returns a candidate + confidence so the UI can let the
 * user confirm/override.
 */

const ollama = new Ollama({ host: config.ollama.baseUrl });

export interface ClassificationResult {
  docType: DocType;
  confidence: number; // 0..1
  method: "filename" | "header" | "llm" | "fallback";
  reasoning: string;
}

// --- Filename rules --------------------------------------------------------

function classifyByFilename(fileName: string): ClassificationResult | null {
  const name = fileName.toLowerCase();

  // US Code sections, CFR, state statute citations, FDCPA/FCRA/TILA etc.
  if (/(^|[^a-z])usc(-|_|\.)/i.test(name) || /^us-?code/i.test(name) || /\.statute\./i.test(name) || /\bfdcpa\b|\bfcra\b|\btila\b|\becoa\b/i.test(name)) {
    return { docType: "statute", confidence: 0.9, method: "filename", reasoning: "filename looks like a codified statute" };
  }
  if (/\bcfr\b|regulation|\.reg\./i.test(name)) {
    return { docType: "regulation", confidence: 0.85, method: "filename", reasoning: "filename looks like a regulation" };
  }
  if (/\.contract\.|\bagreement\b|\btos\b|terms-of-service|privacy-policy/i.test(name)) {
    return { docType: "contract", confidence: 0.8, method: "filename", reasoning: "filename indicates a contract or policy document" };
  }
  if (/\bletter\b|\bnotice\b|demand\.|collection\.|correspondence/i.test(name)) {
    return { docType: "correspondence", confidence: 0.7, method: "filename", reasoning: "filename indicates correspondence" };
  }
  if (/intake|client-facts|affidavit|declaration|timeline/i.test(name)) {
    return { docType: "client_facts", confidence: 0.75, method: "filename", reasoning: "filename indicates client facts" };
  }
  if (/caselaw|v\.|opinion|holding|slip-opinion/i.test(name)) {
    return { docType: "caselaw", confidence: 0.7, method: "filename", reasoning: "filename indicates judicial opinion" };
  }
  if (/template|form-|\.form\.|skeleton/i.test(name)) {
    return { docType: "form", confidence: 0.7, method: "filename", reasoning: "filename indicates a template or form" };
  }
  return null;
}

// --- Header rules ----------------------------------------------------------

function classifyByHeader(headText: string): ClassificationResult | null {
  const head = headText.slice(0, 3000);
  const upper = head.toUpperCase();

  if (/UNITED STATES CODE|U\.S\.C\.|\bUSC\b/.test(upper) || /^\s*§\s*\d+/m.test(head)) {
    return { docType: "statute", confidence: 0.9, method: "header", reasoning: "header contains statutory citation pattern" };
  }
  if (/CODE OF FEDERAL REGULATIONS|C\.F\.R\.|\bCFR\b|\bFEDERAL REGISTER\b/.test(upper)) {
    return { docType: "regulation", confidence: 0.9, method: "header", reasoning: "header contains CFR/Federal Register markers" };
  }
  // Caselaw caption "Plaintiff, v. Defendant" or "Appellant v. Appellee"
  if (/\n\s*v\.\s*\n/.test(head) || /\bOPINION OF THE COURT\b|\bHELD:/.test(upper)) {
    return { docType: "caselaw", confidence: 0.85, method: "header", reasoning: "header looks like a judicial opinion caption" };
  }
  if (/AGREEMENT|CONTRACT|TERMS OF SERVICE|TERMS AND CONDITIONS|PRIVACY POLICY/.test(upper)) {
    return { docType: "contract", confidence: 0.8, method: "header", reasoning: "header names a contract or policy document" };
  }
  if (/STATEMENT OF FACTS|AFFIDAVIT|DECLARATION|INTAKE/.test(upper)) {
    return { docType: "client_facts", confidence: 0.85, method: "header", reasoning: "header indicates client-side factual record" };
  }
  if (/DEMAND LETTER|NOTICE OF|COLLECTION NOTICE|RE:\s/.test(upper)) {
    return { docType: "correspondence", confidence: 0.75, method: "header", reasoning: "header indicates a letter or notice" };
  }
  return null;
}

// --- LLM fallback ----------------------------------------------------------

const LLM_SYSTEM = `You are a consumer-law document classifier. You are given the filename and the first page of a PDF.

Choose the SINGLE best label from this list:
- statute        (codified law, binding: US Code, state statutes, e.g. FDCPA)
- regulation     (administrative rule: CFR, Federal Register, state reg)
- caselaw        (judicial opinion, court decision)
- contract       (contract, TOS, privacy policy, disclosure)
- client_facts   (intake notes, affidavit, declaration, timeline of events)
- correspondence (letter, notice, collection notice, email)
- form           (template letter, complaint skeleton, fillable form)
- unknown        (cannot tell)

Respond with a single line of compact JSON EXACTLY of the form:
{"docType":"<label>","confidence":0.0-1.0,"reasoning":"<one short sentence>"}
No preamble, no code fences.`;

function parseLLM(raw: string): ClassificationResult {
  const match = raw.match(/\{[^{}]*"docType"[^{}]*\}/);
  if (!match) {
    return { docType: "unknown", confidence: 0, method: "fallback", reasoning: `unparseable classifier output: ${raw.slice(0, 80)}` };
  }
  try {
    const obj = JSON.parse(match[0]);
    const dt = typeof obj.docType === "string" ? obj.docType : "unknown";
    const docType: DocType = (DOC_TYPES as string[]).includes(dt) ? (dt as DocType) : "unknown";
    const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.4;
    const reasoning = typeof obj.reasoning === "string" ? obj.reasoning.slice(0, 220) : "";
    return { docType, confidence, method: "llm", reasoning };
  } catch {
    return { docType: "unknown", confidence: 0, method: "fallback", reasoning: "invalid classifier JSON" };
  }
}

async function classifyByLLM(fileName: string, headText: string): Promise<ClassificationResult> {
  try {
    const res = await ollama.chat({
      model: config.ollama.chatModel,
      messages: [
        { role: "system", content: LLM_SYSTEM },
        { role: "user", content: `FILENAME: ${fileName}\n\nFIRST PAGE:\n${headText.slice(0, 2400)}` },
      ],
      options: { temperature: 0, num_predict: 160 },
    });
    return parseLLM(res.message.content.trim());
  } catch (err: any) {
    return { docType: "unknown", confidence: 0, method: "fallback", reasoning: `classifier error: ${err?.message ?? "unknown"}` };
  }
}

// --- Entry point -----------------------------------------------------------

export interface ClassifyInput {
  fileName: string;
  /** First ~3000 characters of the extracted PDF text. Optional — filename rules may suffice. */
  headText?: string;
  /** Skip the LLM fallback (useful when Ollama is down or callers want to keep the request cheap). */
  skipLLM?: boolean;
}

/**
 * Classify a document. Returns the best guess even when confidence is low;
 * the caller (upload route / UI) decides whether to override.
 */
export async function classifyDocument(input: ClassifyInput): Promise<ClassificationResult> {
  const byName = classifyByFilename(input.fileName);
  if (byName && byName.confidence >= 0.8) return byName;

  if (input.headText && input.headText.trim().length > 0) {
    const byHead = classifyByHeader(input.headText);
    if (byHead && byHead.confidence >= 0.8) return byHead;
    if (byHead && (!byName || byHead.confidence > byName.confidence)) {
      if (!input.skipLLM) {
        const llm = await classifyByLLM(input.fileName, input.headText);
        if (llm.confidence > byHead.confidence) return llm;
      }
      return byHead;
    }
  }

  if (byName) return byName;

  if (input.headText && !input.skipLLM) {
    return classifyByLLM(input.fileName, input.headText);
  }
  return { docType: "unknown", confidence: 0, method: "fallback", reasoning: "no signals available" };
}

/**
 * Probe a PDF buffer for the first pages' plain text, cheap enough to run
 * inline during upload. Wraps pdf-parse so callers don't need to depend on
 * it directly.
 */
export async function extractHeadText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer, { max: 2 });
    return data.text ?? "";
  } catch {
    return "";
  }
}
