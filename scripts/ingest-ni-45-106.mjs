#!/usr/bin/env node
/**
 * Ingest NI 45-106 (Prospectus Exemptions) from the CSA consolidation PDF
 * into a typed `CognitionItem[]` authority corpus.
 *
 * Input:  /Users/slavaz/Downloads/ni_20251204_45-106_unofficial-consolidation.pdf
 *         (or first positional CLI arg)
 * Output: packages/cognition/src/ni-45-106-authorities.ts
 *
 * Strategy:
 *   1. `pdf-parse` extracts the full text (~88 pages, ~189K chars).
 *   2. A two-pass sectioner splits on Part / Division / section-number /
 *      Appendix boundaries. Section numbers use the anchored regex
 *      /^\d+\.\d+[a-z]?\s/ at line start — CSA consolidations put section
 *      numbers at the start of the rule body, not in a heading line.
 *   3. Titles come from the canonical SECTION_TITLES map below, derived
 *      from the PDF's Table of Contents. Keeps output stable across
 *      consolidation revisions where body text shifts but the section
 *      numbering is conserved.
 *   4. Each section becomes one CognitionItem. Oversized sections (>1800
 *      approx. tokens) split on subsection `(1)` / `(2)` boundaries
 *      with `-a`, `-b` suffixes on the id.
 *   5. Forms (45-106F1 through F19) and Appendices (A–D) get their own
 *      items, same treatment.
 *
 * Re-run after a new CSA consolidation release:
 *   node scripts/ingest-ni-45-106.mjs [path-to-new-pdf]
 *
 * The generated file has a "do not edit by hand" banner. If you need to
 * adjust titles or registrationCategories, edit this script and re-run.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// pdf-parse lives in packages/ingest; use createRequire so we can resolve
// it from the workspace layout. Mirrors packages/ingest/src/parsers.ts:87-92.
const nodeRequire = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadPdfParse() {
  const candidatePaths = [
    path.join(repoRoot, "packages/ingest/node_modules/pdf-parse"),
    path.join(repoRoot, "node_modules/pdf-parse"),
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const mod = nodeRequire(p);
        return mod.default ?? mod;
      }
    } catch {
      // try next
    }
  }
  throw new Error("pdf-parse is not installed. Run `pnpm install` at the repo root first.");
}

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

/**
 * Which registrant audiences each structural part / form / appendix targets.
 * Shapes retrieval filtering: an EMD reviewing an OM shouldn't surface
 * Portfolio Manager supervisory rules; a Form 45-106F1 (exempt distribution
 * report) is primarily an issuer + dealer-filer concern.
 *
 * Defaults tuned for the compliance-AI demo flow (securities OM review for
 * EMD + issuer). Broaden if/when PM or IIROC surfaces land.
 */
const REGISTRATION_MAP = {
  "part-1": ["emd", "pm", "issuer", "iiroc"],
  "part-2": ["emd", "issuer"],
  "part-2-division-1": ["emd", "issuer"],
  "part-2-division-2": ["emd", "issuer"],
  "part-2-division-3": ["pm", "issuer"],
  "part-2-division-4": ["issuer"],
  "part-2-division-5": ["emd", "issuer"],
  "part-3": ["issuer"],
  "part-4": ["emd", "iiroc", "issuer"],
  "part-5": ["issuer", "iiroc"],
  "part-6": ["issuer", "emd"],
  "part-7": ["emd", "pm", "issuer", "iiroc"],
  "part-8": ["emd", "pm", "issuer", "iiroc"],
  "form-1": ["issuer", "emd"],
  "form-2": ["emd", "issuer"],
  "form-3": ["emd", "issuer"],
  "form-4": ["emd", "issuer"],
  "form-5": ["issuer"],
  "form-7": ["issuer"],
  "form-8": ["issuer"],
  "form-9": ["issuer"],
  "form-12": ["issuer"],
  "form-14": ["issuer"],
  "form-15": ["issuer"],
  "form-16": ["issuer"],
  "form-17": ["issuer"],
  "form-18": ["issuer"],
  "form-19": ["issuer", "iiroc"],
  appendix: ["emd", "pm", "issuer", "iiroc"],
};

/**
 * Canonical section titles from the NI 45-106 Table of Contents. CSA
 * consolidations put section numbers inline with rule body (no heading
 * line), so titles are supplied externally. Last synced: 2025-12-04.
 */
const SECTION_TITLES = {
  1.1: "Definitions",
  1.2: 'Accredited investor — paragraph (t) "permitted client" interpretation',
  1.3: "Interpretation of indirect interest",
  1.4: "Affiliate",
  1.5: "Control / Registration requirement — availability of exemptions that reference a registered dealer",
  1.6: "Definition of distribution — Manitoba",
  1.7: "Definition of trade — Québec",
  1.8: "Designation of insider — Ontario",
  1.9: 'Interpretation of "market price"',
  2.1: "Rights offering — reporting issuer",
  "2.1.1": "Rights offering — stand-by commitment",
  "2.1.2": "Rights offering — issuer with a minimal connection to Canada",
  "2.1.3": "Rights offering — listing representation exemption",
  "2.1.4": "Rights offering — civil liability for secondary market disclosure",
  2.2: "Reinvestment plan",
  2.3: "Accredited investor",
  2.4: "Private issuer",
  2.5: "Family, friends and business associates",
  2.6: "Family, friends and business associates — Saskatchewan",
  2.7: "[repealed] Family, friends and business associates — Ontario",
  2.8: "Affiliates",
  2.9: "Offering memorandum",
  "2.10": "Minimum amount investment",
  2.11: "Business combination and reorganization",
  2.12: "Asset acquisition",
  2.13: "Petroleum, natural gas and mining properties",
  2.14: "Securities for debt",
  2.15: "Issuer acquisition or redemption",
  2.16: "Take-over bid and issuer bid",
  2.17: "Offer to acquire to security holder outside local jurisdiction",
  2.18: "Investment fund reinvestment",
  2.19: "Additional investment in investment funds",
  "2.20": "Private investment club",
  2.21: "Private investment fund — loan and trust pools",
  2.22: "Definitions — Division 4 (Employee, Executive Officer, Director, Consultant Exemptions)",
  2.23: "Interpretation — Division 4",
  2.24: "Employee, executive officer, director and consultant",
  2.25: "Unlisted reporting issuer exception",
  2.26: "Distributions among current or former employees, executive officers, directors, or consultants of non-reporting issuer",
  2.27: "Permitted transferees",
  2.28: "Limitations re: permitted transferees",
  2.29: "Issuer bid (Division 4)",
  "2.30": "Isolated distribution by issuer",
  2.31: "Dividends and distributions",
  2.32: "Distribution to lender by control person for collateral",
  2.33: "Acting as underwriter",
  2.34: "Specified debt",
  2.35: "Short-term debt",
  2.36: "Short-term securitized products",
  2.37: "Limitations on short-term securitized product exemption",
  2.38: "Exceptions relating to liquid assets",
  2.39: "Mortgages",
  "2.40": "Personal property security legislation",
  2.41: "Conversion, exchange, or exercise of previously-issued securities",
  2.42: "Self-directed registered educational savings plans",
  2.43: "Self-directed RESP",
  4.1: "Definitions — control block distributions",
  4.2: "Control block distribution exemption",
  5.1: "Application of Part (TSX Venture Exchange offering document)",
  5.2: "Distribution under TSX Venture Exchange offering document",
  5.3: "Underwriter exemption (TSX Venture)",
  6.1: "Report of exempt distribution",
  6.2: "When report not required",
  6.3: "Required form of report",
  6.4: "Required form of offering memorandum (Forms 45-106F2 and 45-106F3)",
  6.5: "Required form of risk acknowledgement (Form 45-106F4 and Form 45-106F9)",
  7.1: "Exemption (discretionary relief)",
  8.1: "Reinvestment plan — investment fund transitional",
  8.2: "Continuation of existing exemptions",
  8.3: "Definitions — transitional",
  8.4: "Pre-existing reinvestment plans",
  8.5: "[repealed]",
  8.6: "Coming into force — repeal of former NI 45-106 Prospectus and Registration Exemptions",
  8.7: "Coming into force",
  // Sub-sections discovered in the 2025-12-04 consolidation:
  "1.1.1":
    "Additional definitions — Alberta, New Brunswick, Nova Scotia, Ontario, Québec and Saskatchewan",
  "2.6.1": "Family, friends and business associates — Ontario",
  "2.35.1": "Short-term securitized product — prospectus exemption",
  "2.35.2": "Short-term securitized product — conditions",
  "2.35.3": "Short-term securitized product — liquidity provider carve-out",
  "2.35.4": "Short-term securitized product — conduit disclosure and reporting",
  "8.1.1": "[repealed]",
  "8.3.1": "[repealed]",
  "8.4.1":
    "Transitional — s. 2.9(5.1) cross-reference (Alberta, New Brunswick, Nova Scotia, Québec)",
  "8.4.2":
    "Transitional — s. 2.9(17.1)(a) cross-reference (Alberta, New Brunswick, Nova Scotia, Québec)",
  "8.4.3": "Transitional — investment fund report of exempt distribution",
};

const PART_TITLES = {
  "part-1": "Definitions and Interpretation",
  "part-2": "Prospectus Exemptions",
  "part-3": "[Repealed]",
  "part-4": "Control Block Distributions",
  "part-5": "Offerings by TSX Venture Exchange Offering Document",
  "part-6": "Reporting Requirements",
  "part-7": "Exemption",
  "part-8": "Transitional, Coming into Force",
};

const APPENDIX_TITLES = {
  A: "Variable insurance contract exemption",
  B: "Control Block Distribution",
  C: "Listing Representation Prohibitions",
  D: "Secondary Market Liability Provisions",
};

const FORM_TITLES = {
  1: "Form 45-106F1 — Report of Exempt Distribution",
  2: "Form 45-106F2 — Offering Memorandum for Non-Qualifying Issuers",
  3: "Form 45-106F3 — Offering Memorandum for Qualifying Issuers",
  4: "Form 45-106F4 — Risk Acknowledgement",
  5: "Form 45-106F5 — [historical / schedule]",
  7: "Form 45-106F7 — Notice of Specified Key Events",
  8: "Form 45-106F8 — Confirmation of Purchase (Rights Offering)",
  9: "Form 45-106F9 — Risk Acknowledgement (Individual Accredited Investors)",
  12: "Form 45-106F12 — Notice of Use of Equity Crowdfunding Exemption",
  14: "Form 45-106F14 — Rights Offering Notice (Reporting Issuer)",
  15: "Form 45-106F15 — Rights Offering Circular (Reporting Issuer)",
  16: "Form 45-106F16 — Rights Offering Notice (Non-Reporting Issuer)",
  17: "Form 45-106F17 — Rights Offering Circular (Non-Reporting Issuer)",
  18: "Form 45-106F18 — Security Holder Direction",
  19: "Form 45-106F19 — Listed Issuer Financing Document",
};

const MAX_CONTENT_CHARS = 7200; // ≈ 1800 tokens (4 chars/token heuristic)
const CONSOLIDATION_DATE = "2025-12-04";
const SOURCE_NAME = `National Instrument 45-106 Prospectus Exemptions (unofficial consolidation current to ${CONSOLIDATION_DATE})`;

// ---------------------------------------------------------------------------
// EXTRACTION
// ---------------------------------------------------------------------------

function stripBoilerplate(rawText) {
  const headerPatterns = [
    /^Ontario Securities Commission\s*$/i,
    /^National Instrument 45-106\s*$/i,
    /^Unofficial consolidation current to .+$/i,
    /^\s*\d+\s*$/,
  ];
  return rawText
    .split(/\n/)
    .filter((l) => {
      const trimmed = l.trim();
      if (!trimmed) return true;
      return !headerPatterns.some((re) => re.test(trimmed));
    })
    .join("\n");
}

/**
 * Locate all structural boundary points. Returns markers sorted by offset.
 */
function findBoundaries(text) {
  const markers = [];
  const lines = text.split(/\n/);
  let offset = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const lineOffset = offset;
    offset += rawLine.length + 1; // +1 for the newline

    if (!line) continue;

    // Part boundary: "Part 1 Definitions" or "PART 1 — ..."
    let m = line.match(/^(?:Part|PART)\s+(\d+)(?:\s+(.+))?$/);
    if (m) {
      markers.push({
        kind: "part",
        number: m[1],
        title: m[2] || PART_TITLES[`part-${m[1]}`] || "",
        offset: lineOffset,
      });
      continue;
    }

    // Division boundary: "Division 1: Capital Raising Exemptions"
    m = line.match(/^Division\s+(\d+):\s+(.+)$/);
    if (m) {
      markers.push({
        kind: "division",
        number: m[1],
        title: m[2],
        offset: lineOffset,
      });
      continue;
    }

    // Section boundary: "N.N[.N]?[a-z]? <text not starting with digit>".
    // Reject cross-reference artifacts: body text sometimes wraps with a
    // line like "1.1 [Definitions] unless the person..." which is a
    // citation, not a section heading. Heuristic: a bracketed term
    // followed by prose ("] something...") is a cross-ref. A section body
    // that only contains "[repealed]" is legitimate and should pass.
    m = line.match(/^(\d+\.\d+(?:\.\d+)?[a-z]?)\s+(.*)$/);
    if (m && m[2] && !/^\d/.test(m[2]) && m[2].length >= 3) {
      const isBracketedCrossRef = /^\[[^\]]+\]\s+\S/.test(m[2]);
      if (!isBracketedCrossRef) {
        markers.push({
          kind: "section",
          number: m[1],
          firstLine: m[2],
          offset: lineOffset,
        });
        continue;
      }
    }

    // Appendix boundary: "APPENDIX A"
    m = line.match(/^APPENDIX\s+([A-Z])\b/);
    if (m) {
      markers.push({
        kind: "appendix",
        letter: m[1],
        title: APPENDIX_TITLES[m[1]] || "",
        offset: lineOffset,
      });
      continue;
    }

    // Form heading at line start.
    m = line.match(/^(?:FORM|Form)\s+45-106F(\d+[A-Z]?)\b/);
    if (m) {
      markers.push({
        kind: "form",
        number: m[1],
        title: FORM_TITLES[m[1]] || `Form 45-106F${m[1]}`,
        offset: lineOffset,
      });
      continue;
    }
  }

  return markers;
}

function sliceBody(text, markers) {
  const tocEndOffset = detectTocEnd(text, markers);
  const bodyMarkers = markers.filter((m) => m.offset >= tocEndOffset);

  // Dedupe: keep the FIRST marker per (kind, number/letter) after the TOC.
  // Cross-reference artifacts (e.g. "1.1 [Definitions] unless...") appear
  // LATER in the body as in-rule citations. The first occurrence after
  // TOC is the authoritative section body.
  const dedupedMap = new Map();
  for (const m of bodyMarkers) {
    const key = `${m.kind}:${m.number ?? m.letter ?? ""}`;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, m);
    }
  }
  const deduped = [...dedupedMap.values()].sort((a, b) => a.offset - b.offset);

  const slices = [];
  for (let i = 0; i < deduped.length; i++) {
    const start = deduped[i].offset;
    const end = i + 1 < deduped.length ? deduped[i + 1].offset : text.length;
    const body = text.slice(start, end).trim();
    slices.push({ ...deduped[i], body });
  }
  return slices;
}

/**
 * TOC ends where the rule body begins. Primary signal: "PART 1" in
 * uppercase (body heading style, not used in TOC which uses "Part 1").
 */
function detectTocEnd(text, markers) {
  const m = text.match(/\n\s*PART\s+1\b/);
  if (m) return m.index;

  const oneOnes = markers.filter((x) => x.kind === "section" && x.number === "1.1");
  if (oneOnes.length >= 2) return oneOnes[1].offset;

  return 3000;
}

function assignContext(slices) {
  let currentPart = null;
  let currentDivision = null;

  for (const slice of slices) {
    if (slice.kind === "part") {
      currentPart = slice.number;
      currentDivision = null;
      slice.partNumber = currentPart;
    } else if (slice.kind === "division") {
      currentDivision = slice.number;
      slice.partNumber = currentPart;
      slice.divisionNumber = currentDivision;
    } else if (slice.kind === "section") {
      slice.partNumber = currentPart;
      slice.divisionNumber = currentDivision;
    } else if (slice.kind === "appendix" || slice.kind === "form") {
      slice.partNumber = null;
      slice.divisionNumber = null;
    }
  }
  return slices;
}

// ---------------------------------------------------------------------------
// CONTENT ASSEMBLY
// ---------------------------------------------------------------------------

function normalizeBody(body) {
  // Collapse intra-paragraph line wraps. Two+ newlines = paragraph break.
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function computeRegistrationCategories({ kind, partNumber, divisionNumber, formNumber }) {
  if (kind === "appendix") return REGISTRATION_MAP.appendix;
  if (kind === "form" && formNumber) {
    return REGISTRATION_MAP[`form-${formNumber}`] ?? REGISTRATION_MAP.appendix;
  }
  if (partNumber && divisionNumber) {
    const key = `part-${partNumber}-division-${divisionNumber}`;
    if (REGISTRATION_MAP[key]) return REGISTRATION_MAP[key];
  }
  if (partNumber) {
    const key = `part-${partNumber}`;
    if (REGISTRATION_MAP[key]) return REGISTRATION_MAP[key];
  }
  return REGISTRATION_MAP.appendix;
}

/**
 * Pull cross-references (section X.Y, Part N, Form 45-106F\d+) out of
 * the body and append as a search hint. Helps BM25 find the right item
 * when the query references a related rule.
 */
function extractCrossRefs(body) {
  const refs = new Set();
  for (const match of body.matchAll(/\bsection\s+(\d+\.\d+(?:\.\d+)?[a-z]?)\b/gi)) {
    refs.add(`s. ${match[1]}`);
  }
  for (const match of body.matchAll(/\bPart\s+(\d+)\b/g)) {
    refs.add(`Part ${match[1]}`);
  }
  for (const match of body.matchAll(/\b(?:Form|FORM)\s+45-106F(\d+[A-Z]?)\b/g)) {
    refs.add(`Form 45-106F${match[1]}`);
  }
  return [...refs];
}

function buildCognitionItem(slice) {
  const { kind, number, letter, partNumber, divisionNumber, body } = slice;
  const normalizedBody = normalizeBody(body);

  let id, title, content, registrationCategories;

  if (kind === "section") {
    const canonicalTitle = SECTION_TITLES[number];
    if (!canonicalTitle) {
      console.warn(`  ⚠️  Section ${number} has no canonical title — using body preview.`);
    }
    const heading = canonicalTitle || slice.firstLine?.slice(0, 90) || `Section ${number}`;
    id = `auth-ni-45-106-${number}`;
    title = `NI 45-106 s. ${number} — ${heading}`;
    content = `Section ${number} — ${heading}\n\n${normalizedBody}`;
    registrationCategories = computeRegistrationCategories({ kind, partNumber, divisionNumber });
  } else if (kind === "part") {
    id = `auth-ni-45-106-part-${number}`;
    title = `NI 45-106 Part ${number} — ${PART_TITLES[`part-${number}`] || slice.title}`;
    content = `Part ${number} — ${PART_TITLES[`part-${number}`] || slice.title}\n\n${normalizedBody}`;
    registrationCategories = computeRegistrationCategories({ kind, partNumber: number });
  } else if (kind === "division") {
    id = `auth-ni-45-106-part-${partNumber}-division-${number}`;
    title = `NI 45-106 Part ${partNumber}, Division ${number} — ${slice.title}`;
    content = `Part ${partNumber}, Division ${number} — ${slice.title}\n\n${normalizedBody}`;
    registrationCategories = computeRegistrationCategories({
      kind: "section",
      partNumber,
      divisionNumber: number,
    });
  } else if (kind === "appendix") {
    id = `auth-ni-45-106-appendix-${letter.toLowerCase()}`;
    title = `NI 45-106 Appendix ${letter} — ${APPENDIX_TITLES[letter] || slice.title}`;
    content = `Appendix ${letter} — ${APPENDIX_TITLES[letter] || slice.title}\n\n${normalizedBody}`;
    registrationCategories = computeRegistrationCategories({ kind });
  } else if (kind === "form") {
    id = `auth-ni-45-106-f${number}`;
    title = `${FORM_TITLES[number] || `Form 45-106F${number}`}`;
    content = `${FORM_TITLES[number] || `Form 45-106F${number}`}\n\n${normalizedBody}`;
    registrationCategories = computeRegistrationCategories({ kind, formNumber: number });
  } else {
    return null;
  }

  const crossRefs = extractCrossRefs(normalizedBody);
  if (crossRefs.length) {
    content += `\n\nCross-references: ${crossRefs.join("; ")}.`;
  }
  content += `\n\nSource: NI 45-106 unofficial consolidation current to ${CONSOLIDATION_DATE}.`;

  return {
    id,
    organizationId: "preview",
    title,
    content,
    source: SOURCE_NAME,
    jurisdiction: "ontario",
    registrationCategories,
  };
}

/**
 * Pack a list of already-split pieces into chunks that fit under maxSize.
 * Greedy: accumulate pieces into `current`, flush when it would overflow.
 */
function packPieces(pieces, maxSize) {
  const chunks = [];
  let current = "";
  for (const p of pieces) {
    if (current.length + p.length > maxSize && current.length > 0) {
      chunks.push(current);
      current = p;
    } else {
      current += p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Recursively split a text body into chunks of at most `maxSize` chars.
 * Tries progressively finer delimiters: subsection markers → paragraph
 * breaks → sentence breaks → hard word boundary cut.
 *
 * The return value always joins back to (approximately) the original body
 * — whitespace between delimiters is preserved.
 */
function splitBodyRecursive(body, maxSize) {
  if (body.length <= maxSize) return [body];

  // Strategy 1: subsection markers (1), (2), (3). Lookahead preserves them.
  const subsectionPieces = body.split(/(?=\n\(\d+\)\s)/);
  if (subsectionPieces.length >= 2) {
    const packed = packPieces(subsectionPieces, maxSize);
    if (packed.every((c) => c.length <= maxSize)) return packed;
    // Recurse on any still-oversize chunk.
    return packed.flatMap((c) => (c.length > maxSize ? splitBodyRecursive(c, maxSize) : [c]));
  }

  // Strategy 2: paragraph breaks. Keep the delimiter attached to the
  // preceding piece so reassembly preserves spacing.
  const paragraphRegex = /\n\n/;
  if (paragraphRegex.test(body)) {
    const pieces = [];
    let start = 0;
    for (const match of body.matchAll(/\n\n/g)) {
      pieces.push(body.slice(start, match.index + 2));
      start = match.index + 2;
    }
    if (start < body.length) pieces.push(body.slice(start));
    if (pieces.length >= 2) {
      const packed = packPieces(pieces, maxSize);
      if (packed.every((c) => c.length <= maxSize)) return packed;
      return packed.flatMap((c) => (c.length > maxSize ? splitBodyRecursive(c, maxSize) : [c]));
    }
  }

  // Strategy 3: sentence breaks on ". " followed by capital letter.
  const sentencePieces = body.split(/(?<=\. )(?=[A-Z])/);
  if (sentencePieces.length >= 2) {
    const packed = packPieces(sentencePieces, maxSize);
    if (packed.every((c) => c.length <= maxSize)) return packed;
    return packed.flatMap((c) => (c.length > maxSize ? splitBodyRecursive(c, maxSize) : [c]));
  }

  // Last resort: hard word-boundary cut at/near maxSize.
  let cut = body.lastIndexOf(" ", maxSize);
  if (cut <= 0) cut = maxSize;
  const head = body.slice(0, cut).trimEnd();
  const tail = body.slice(cut).trimStart();
  return [head, ...splitBodyRecursive(tail, maxSize)];
}

function splitIfOversize(item) {
  if (item.content.length <= MAX_CONTENT_CHARS) return [item];

  // Content shape: "Header\n\nBody…\n\nCross-references: …\n\nSource: …".
  // We need to split the rule body without losing the cross-refs / source
  // footer from intermediate chunks. Separate out trailer lines first, then
  // split only the rule body, then re-attach the trailer to every chunk.
  const headerMatch = item.content.match(/^(.+?)\n\n/s);
  const header = headerMatch ? headerMatch[1] : item.title;
  const bodyStart = headerMatch ? headerMatch[0].length : 0;
  const afterHeader = item.content.slice(bodyStart);

  // Locate the earliest trailer separator and split content into body + trailer.
  const trailerSeparators = ["\n\nCross-references:", "\n\nSource:"];
  let trailerStart = afterHeader.length;
  for (const sep of trailerSeparators) {
    const idx = afterHeader.indexOf(sep);
    if (idx >= 0 && idx < trailerStart) trailerStart = idx;
  }
  const pureBody = afterHeader.slice(0, trailerStart).trim();
  const trailer = afterHeader.slice(trailerStart); // includes leading \n\n

  // Reserve budget for the header + " (continued, part N)\n\n" + trailer.
  const budget = Math.max(MAX_CONTENT_CHARS - header.length - trailer.length - 30, 800);
  const bodyChunks = splitBodyRecursive(pureBody, budget);

  const alpha = "abcdefghijklmnopqrstuvwxyz";
  return bodyChunks.map((chunkBody, i) => ({
    ...item,
    id: `${item.id}-${alpha[i] || `x${i}`}`,
    content:
      (i === 0
        ? `${header}\n\n${chunkBody.trim()}`
        : `${header} (continued, part ${i + 1})\n\n${chunkBody.trim()}`) + trailer,
  }));
}

// ---------------------------------------------------------------------------
// EMIT
// ---------------------------------------------------------------------------

function emitTypeScript(items) {
  const banner = `/**
 * NI 45-106 authority corpus — AUTO-GENERATED, DO NOT EDIT BY HAND.
 *
 * Generated by scripts/ingest-ni-45-106.mjs from the CSA unofficial
 * consolidation PDF current to ${CONSOLIDATION_DATE}.
 *
 * To refresh after a new CSA consolidation:
 *   node scripts/ingest-ni-45-106.mjs [path-to-new-pdf]
 *
 * Count: ${items.length} items covering sections, parts, divisions, forms, and appendices.
 *
 * Each item uses:
 *   id:                      auth-ni-45-106-{kind}-{number}
 *   organizationId:          "preview" — re-tagged at bootstrap per tenant
 *   source:                  "${SOURCE_NAME}"
 *   jurisdiction:            "ontario"
 *   registrationCategories:  per REGISTRATION_MAP in the generator script
 */

import type { CognitionItem } from "./types.js";

export const NI_45_106_AUTHORITIES: CognitionItem[] = `;

  const jsonBody = JSON.stringify(items, null, 2);
  const footer = ";\n";
  return banner + jsonBody + footer;
}

function assertUniqueIds(items) {
  const seen = new Map();
  for (const it of items) {
    if (seen.has(it.id)) {
      throw new Error(
        `Duplicate id "${it.id}" — second title="${it.title}", first title="${seen.get(it.id)}"`,
      );
    }
    seen.set(it.id, it.title);
  }
}

function coverageReport(items) {
  const sections = items.filter((i) => /^auth-ni-45-106-\d+\.\d+/.test(i.id));
  const parts = items.filter((i) => /^auth-ni-45-106-part-\d+$/.test(i.id));
  const divisions = items.filter((i) => /division-\d+$/.test(i.id));
  const forms = items.filter((i) => /^auth-ni-45-106-f\d+/.test(i.id));
  const appendices = items.filter((i) => /^auth-ni-45-106-appendix-/.test(i.id));
  const oversizeSplits = items.filter((i) => /-[a-z]$/.test(i.id)).length;
  const maxContentLen = Math.max(...items.map((i) => i.content.length));
  const totalContent = items.reduce((sum, i) => sum + i.content.length, 0);

  return {
    total: items.length,
    sections: sections.length,
    parts: parts.length,
    divisions: divisions.length,
    forms: forms.length,
    appendices: appendices.length,
    oversizeSplits,
    maxContentLen,
    totalContent,
  };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const argPath = process.argv[2];
  const defaultPath = path.join(
    os.homedir(),
    "Downloads/ni_20251204_45-106_unofficial-consolidation.pdf",
  );
  const pdfPath = argPath ? path.resolve(argPath) : defaultPath;

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF not found at ${pdfPath}`);
    console.error(
      `   Pass the path as the first argument or place the file at the default location.`,
    );
    process.exit(1);
  }

  console.log(`📄 Reading ${pdfPath}`);
  const pdfParse = await loadPdfParse();
  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(buffer);
  console.log(`   Pages: ${parsed.numpages}, text length: ${parsed.text.length} chars`);

  const cleaned = stripBoilerplate(parsed.text);
  const markers = findBoundaries(cleaned);
  console.log(`   Boundaries found: ${markers.length}`);

  const slices = sliceBody(cleaned, markers);
  console.log(`   Body slices (after TOC + dedupe): ${slices.length}`);

  assignContext(slices);

  const items = [];
  const warnings = [];
  for (const slice of slices) {
    if (slice.body.length < 40) {
      if (slice.kind === "section" && /\[repealed\]/i.test(slice.body)) {
        const tiny = buildCognitionItem({ ...slice, body: `[repealed] — see title.` });
        if (tiny) items.push(tiny);
      }
      continue;
    }
    const item = buildCognitionItem(slice);
    if (!item) continue;
    const expanded = splitIfOversize(item);
    items.push(...expanded);
  }

  const emittedSectionNumbers = new Set(
    items
      .filter((i) => /^auth-ni-45-106-\d+\.\d+/.test(i.id))
      .map((i) => i.id.replace(/^auth-ni-45-106-/, "").replace(/-[a-z]$/, "")),
  );
  for (const secNum of Object.keys(SECTION_TITLES)) {
    if (!emittedSectionNumbers.has(secNum)) {
      warnings.push(`Section ${secNum} in SECTION_TITLES map but no body extracted.`);
    }
  }

  assertUniqueIds(items);
  const report = coverageReport(items);

  const outPath = path.join(repoRoot, "packages/cognition/src/ni-45-106-authorities.ts");
  fs.writeFileSync(outPath, emitTypeScript(items));
  // Emit a .js shim so Turbopack's ESM resolver (which follows `.js` specifiers
  // literally) can resolve imports like `from "./ni-45-106-authorities.js"`
  // that the rest of the codebase uses.
  const shimPath = outPath.replace(/\.ts$/, ".js");
  fs.writeFileSync(shimPath, 'export * from "./ni-45-106-authorities.ts";\n');
  console.log(`✅ Wrote ${outPath}`);
  console.log(`   + shim  ${shimPath}`);
  console.log(
    `   ${report.total} items (${report.sections} sections, ${report.parts} parts, ${report.divisions} divisions, ${report.forms} forms, ${report.appendices} appendices)`,
  );
  console.log(
    `   Oversize splits: ${report.oversizeSplits}, max item size: ${report.maxContentLen} chars, total: ${report.totalContent} chars`,
  );

  if (warnings.length) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`   - ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
