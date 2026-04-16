import type { AgentTurn, TranscriptEvent } from "@compliance-ai/chat-structure";

export type { AgentTurn, TranscriptEvent };

export type EvidenceGraphNodeType =
  | "matter"
  | "document"
  | "chunk"
  | "authority"
  | "evidence"
  | "audit";

export interface EvidenceGraphNode {
  id: string;
  type: EvidenceGraphNodeType;
  label: string;
  detail?: string;
}

export interface EvidenceGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}
