import type { AgentTurn, EvidenceGraphEdge, EvidenceGraphNode, TranscriptEvent } from "./matter-context-types";
import { toJsonl } from "@compliance-ai/chat-structure";
import { getDefaultApprovalStore } from "./approvals-store";
import { getDefaultAuditStore, sha256 } from "./audit-store";
import { getDefaultEvidenceStore } from "./evidence-store";
import { getDefaultMatterStore, type Matter, type MatterDocument, type StoredChunk } from "./matter-store";

export interface MatterContextBundle {
  version: "demo-case-pack/v1";
  exportedAt: string;
  matter: Matter;
  documents: MatterDocument[];
  chunks: Array<Pick<StoredChunk, "id" | "docId" | "ordinal" | "content" | "page" | "tokenCount">>;
  evidence: Awaited<ReturnType<ReturnType<typeof getDefaultEvidenceStore>["list"]>>;
  audit: Awaited<ReturnType<ReturnType<typeof getDefaultAuditStore>["getByMatter"]>>;
  approvals: Awaited<ReturnType<ReturnType<typeof getDefaultApprovalStore>["listByMatter"]>>;
  transcript: TranscriptEvent[];
  graph: {
    nodes: EvidenceGraphNode[];
    edges: EvidenceGraphEdge[];
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, "[redacted-phone]")
    .trim();
}

function truncate(value: string, length = 900): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export async function buildTranscriptEvents(matterId: string): Promise<TranscriptEvent[]> {
  const auditStore = getDefaultAuditStore();
  const approvalStore = getDefaultApprovalStore();
  const audit = await auditStore.getByMatter(matterId);
  const approvals = await approvalStore.listByMatter(matterId);

  const auditEvents: TranscriptEvent[] = audit
    .slice()
    .reverse()
    .map((entry) => ({
      id: entry.id,
      matterId,
      type: entry.action === "generation" ? "agent" : "audit",
      actor: entry.actor,
      action: entry.action,
      content: truncate(cleanText(entry.outputContent ?? entry.inputContent ?? entry.action)),
      createdAt: iso(entry.timestamp),
      metadata: {
        inputHash: entry.inputHash,
        outputHash: entry.outputHash,
        authoritiesUsed: entry.authoritiesUsed,
        judgeVerdict: entry.judgeVerdict,
      },
    }));

  const approvalEvents: TranscriptEvent[] = approvals.map((approval) => ({
    id: approval.id,
    matterId,
    type: "approval",
    actor: approval.reviewedBy ?? approval.requestedBy,
    action: `approval-${approval.status}`,
    content: cleanText(approval.rationale ?? approval.summary),
    createdAt: iso(approval.reviewedAt ?? approval.requestedAt),
    metadata: {
      outputHash: approval.outputHash,
      status: approval.status,
    },
  }));

  return [...auditEvents, ...approvalEvents].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}

export function transcriptToAgentTurns(events: TranscriptEvent[]): AgentTurn[] {
  return events.map((event) => ({
    id: event.id,
    role: event.type === "agent" ? "assistant" : "system",
    agent: event.actor === "system" ? "system" : undefined,
    content: event.content,
    createdAt: event.createdAt,
  }));
}

export async function buildEvidenceGraph(matterId: string): Promise<{
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}> {
  const matterStore = getDefaultMatterStore();
  const evidenceStore = getDefaultEvidenceStore();
  const auditStore = getDefaultAuditStore();
  const matter = await matterStore.get(matterId);
  if (!matter) return { nodes: [], edges: [] };

  const documents = await matterStore.getDocuments(matterId);
  const chunks = (await matterStore.getChunksByMatter(matterId)).slice(0, 18);
  const evidence = await evidenceStore.list(matterId);
  const audit = await auditStore.getByMatter(matterId);

  const nodes: EvidenceGraphNode[] = [
    {
      id: matter.id,
      type: "matter",
      label: matter.title,
      detail: `${matter.taskType} · ${matter.jurisdiction} / ${matter.registrationCategory}`,
    },
  ];
  const edges: EvidenceGraphEdge[] = [];

  for (const document of documents) {
    nodes.push({
      id: document.id,
      type: "document",
      label: document.filename,
      detail: `${document.documentType} · ${document.chunkCount} chunks`,
    });
    edges.push({ id: `${matter.id}:${document.id}`, source: matter.id, target: document.id, label: "contains" });
  }

  for (const chunk of chunks) {
    nodes.push({
      id: chunk.id,
      type: "chunk",
      label: `Chunk ${chunk.ordinal + 1}`,
      detail: truncate(chunk.content, 160),
    });
    edges.push({ id: `${chunk.docId}:${chunk.id}`, source: chunk.docId, target: chunk.id, label: "grounds" });
  }

  for (const item of evidence) {
    nodes.push({
      id: item.id,
      type: "evidence",
      label: item.title,
      detail: `${item.status}${item.source ? ` · ${item.source}` : ""}`,
    });
    edges.push({ id: `${matter.id}:${item.id}`, source: matter.id, target: item.id, label: "needs" });
  }

  for (const entry of audit.slice(0, 12)) {
    nodes.push({
      id: entry.id,
      type: "audit",
      label: `${entry.actor}: ${entry.action}`,
      detail: truncate(cleanText(entry.outputContent ?? entry.inputContent ?? ""), 180),
    });
    edges.push({ id: `${matter.id}:${entry.id}`, source: matter.id, target: entry.id, label: "records" });

    for (const authorityId of entry.authoritiesUsed.slice(0, 6)) {
      const authorityNodeId = `authority:${authorityId}`;
      if (!nodes.some((node) => node.id === authorityNodeId)) {
        nodes.push({
          id: authorityNodeId,
          type: "authority",
          label: authorityId,
          detail: "Retrieved authority",
        });
      }
      edges.push({
        id: `${entry.id}:${authorityNodeId}`,
        source: entry.id,
        target: authorityNodeId,
        label: "cites",
      });
    }
  }

  return { nodes, edges };
}

export async function buildMatterContextBundle(matterId: string): Promise<MatterContextBundle | null> {
  const matterStore = getDefaultMatterStore();
  const evidenceStore = getDefaultEvidenceStore();
  const auditStore = getDefaultAuditStore();
  const approvalStore = getDefaultApprovalStore();
  const matter = await matterStore.get(matterId);
  if (!matter) return null;

  const documents = await matterStore.getDocuments(matterId);
  const chunks = (await matterStore.getChunksByMatter(matterId)).map((chunk) => ({
    id: chunk.id,
    docId: chunk.docId,
    ordinal: chunk.ordinal,
    content: chunk.content,
    ...(chunk.page !== undefined ? { page: chunk.page } : {}),
    tokenCount: chunk.tokenCount,
  }));
  const evidence = await evidenceStore.list(matterId);
  const audit = (await auditStore.getByMatter(matterId)).slice().reverse();
  const approvals = await approvalStore.listByMatter(matterId);
  const transcript = await buildTranscriptEvents(matterId);
  const graph = await buildEvidenceGraph(matterId);

  return {
    version: "demo-case-pack/v1",
    exportedAt: new Date().toISOString(),
    matter,
    documents,
    chunks,
    evidence,
    audit,
    approvals,
    transcript,
    graph,
  };
}

export function renderCrumbHandoff(bundle: MatterContextBundle): string {
  const missingEvidence = bundle.evidence.filter((item) =>
    item.status === "missing" || item.status === "requested" || item.status === "stale",
  );
  const latestGeneration = bundle.audit
    .slice()
    .reverse()
    .find((entry) => entry.action === "generation");
  const citations = new Set(bundle.audit.flatMap((entry) => entry.authoritiesUsed));
  const approval = bundle.approvals[0];

  const lines = [
    "---",
    "type: task",
    "description: Compliance-AI demo handoff",
    "crumb-version: 1.2",
    "---",
    "",
    "# Compliance-AI Handoff",
    "",
    "## Matter",
    `- Title: ${cleanText(bundle.matter.title)}`,
    `- Surface: securities`,
    `- Task: ${bundle.matter.taskType}`,
    `- Scope: ${bundle.matter.jurisdiction} / ${bundle.matter.registrationCategory}`,
    `- Status: ${bundle.matter.status}`,
    `- Export hash: ${sha256(bundle.matter.id + bundle.exportedAt)}`,
    "",
    "## Documents",
    ...bundle.documents.map(
      (doc) => `- ${cleanText(doc.filename)} (${doc.documentType}, ${doc.chunkCount} chunks)`,
    ),
    "",
    "## Latest Output",
    latestGeneration
      ? truncate(cleanText(latestGeneration.outputContent), 1400)
      : "No generated output has been recorded yet.",
    "",
    "## Top Citations",
    ...(citations.size > 0
      ? [...citations].slice(0, 8).map((id) => `- ${id}`)
      : ["- No retrieved authority citations recorded yet."]),
    "",
    "## Evidence Gaps",
    ...(missingEvidence.length > 0
      ? missingEvidence.slice(0, 8).map((item) => `- [${item.status}] ${cleanText(item.title)}`)
      : ["- No open evidence gaps recorded."]),
    "",
    "## Approval State",
    approval
      ? `- ${approval.status}: ${cleanText(approval.summary)}`
      : "- No approval request has been created yet.",
    "",
    "## Next Actions",
    "- Review the latest output against the cited authorities.",
    "- Resolve missing or stale evidence before external submission.",
    "- Request approval once the judge verdict is READY_TO_SUBMIT.",
    "",
    "[handoff]",
    `source=compliance-ai matter=${bundle.matter.id} exported=${bundle.exportedAt}`,
  ];

  return `${lines.join("\n")}\n`;
}

export function transcriptJsonl(events: TranscriptEvent[]): string {
  return `${toJsonl(events)}\n`;
}
