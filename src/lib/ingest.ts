import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { v4 as uuid } from "uuid";
import { config } from "./config";

export interface DocumentChunk {
  id: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  sectionHeader: string | null;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

export interface IngestResult {
  documentId: string;
  fileName: string;
  totalPages: number;
  totalChunks: number;
  chunks: DocumentChunk[];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function detectSectionHeader(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (/^(Section|Part|Article|Chapter|Division)\s+\d/i.test(line)) return line.slice(0, 120);
    if (/^\d+\.\d+/.test(line) && line.length < 120) return line;
    if (line.length > 5 && line.length < 100 && line === line.toUpperCase()) return line;
  }
  return null;
}

function chunkText(text: string, maxTokens: number, overlapTokens: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para;
    if (estimateTokens(combined) > maxTokens && current) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      const overlapWordCount = Math.floor(overlapTokens * 0.75);
      const overlapText = words.slice(-overlapWordCount).join(" ");
      current = overlapText ? `${overlapText}\n\n${para}` : para;
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length === 0 && text.trim()) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let buf = "";
    for (const sent of sentences) {
      if (estimateTokens(buf + sent) > maxTokens && buf) {
        chunks.push(buf.trim());
        buf = sent;
      } else {
        buf += sent;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }

  return chunks;
}

export async function ingestPDF(fileBuffer: Buffer, fileName: string): Promise<IngestResult> {
  const documentId = uuid();
  const data = await pdfParse(fileBuffer);
  const fullText = data.text;
  const numPages = data.numpages;

  // Simple page-agnostic chunking for prototype
  const textChunks = chunkText(fullText, config.chunking.size, config.chunking.overlap);

  const allChunks: DocumentChunk[] = textChunks.map((content, i) => ({
    id: `${documentId}-${i}`,
    documentId,
    fileName,
    pageNumber: Math.ceil(((i + 1) / textChunks.length) * numPages) || 1,
    sectionHeader: detectSectionHeader(content),
    chunkIndex: i,
    totalChunks: textChunks.length,
    content,
    tokenEstimate: estimateTokens(content),
    createdAt: new Date().toISOString(),
  }));

  const chunksDir = config.paths.chunks;
  await fs.mkdir(chunksDir, { recursive: true });
  const outPath = path.join(chunksDir, `${fileName.replace(/\.pdf$/i, "")}-chunks.json`);
  await fs.writeFile(outPath, JSON.stringify(allChunks, null, 2));

  return { documentId, fileName, totalPages: numPages, totalChunks: allChunks.length, chunks: allChunks };
}

export async function loadAllChunks(): Promise<DocumentChunk[]> {
  const chunksDir = config.paths.chunks;
  try {
    const files = await fs.readdir(chunksDir);
    const allChunks: DocumentChunk[] = [];
    for (const file of files.filter((f) => f.endsWith("-chunks.json"))) {
      const raw = await fs.readFile(path.join(chunksDir, file), "utf-8");
      allChunks.push(...JSON.parse(raw));
    }
    return allChunks;
  } catch {
    return [];
  }
}
