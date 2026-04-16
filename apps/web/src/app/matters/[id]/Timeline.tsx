"use client";

/**
 * Multi-persona timeline.
 *
 * Renders the transcript of a matter as a reply-threaded timeline. Agent
 * identity is shown via colored pills (AgentPill), verdict badges live on
 * judge turns, tool-calls render as typed chips, and replies indent under
 * the turn they reply to.
 *
 * Cannibalized from agentchattr's unified channel view, reply threading,
 * and per-message status pills.
 */

import { useEffect, useState, useCallback } from "react";
import { AgentPill } from "./AgentPill";
import type {
  TranscriptTurn,
  Participant,
  ParticipantId,
  ParticipantColor,
} from "@compliance-ai/chat-structure";

interface Props {
  matterId: string;
  /** Re-fetch after the streaming run is done (caller signals completion). */
  refreshKey: number;
}

const VERDICT_STYLE: Record<string, string> = {
  READY_TO_SUBMIT: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  ITERATE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  REWRITE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const FALLBACK_PARTICIPANT: Participant = {
  id: "user",
  name: "Unknown",
  color: "slate",
  initials: "??",
  description: "",
};

export function Timeline({ matterId, refreshKey }: Props) {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [participants, setParticipants] = useState<Record<ParticipantId, Participant>>(
    {} as Record<ParticipantId, Participant>,
  );

  const fetchData = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        fetch(`/api/matters/${matterId}/transcript`).then((r) => r.json()),
        fetch(`/api/agents`).then((r) => r.json()),
      ]);
      setTurns((t.turns ?? []) as TranscriptTurn[]);
      const map: Record<string, Participant> = {};
      for (const pp of (p.participants ?? []) as Participant[]) map[pp.id] = pp;
      setParticipants(map as Record<ParticipantId, Participant>);
    } catch {
      // silent — empty state will render
    }
  }, [matterId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  if (turns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-400">
        No turns yet. Start a review to populate the timeline.
      </div>
    );
  }

  // Build a reply-thread map: parent turn id → child turn ids
  const childrenByParent = new Map<string, TranscriptTurn[]>();
  const roots: TranscriptTurn[] = [];
  for (const turn of turns) {
    if (turn.replyTo) {
      const list = childrenByParent.get(turn.replyTo) ?? [];
      list.push(turn);
      childrenByParent.set(turn.replyTo, list);
    } else {
      roots.push(turn);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {roots.map((turn) => (
        <TurnCard
          key={turn.id}
          turn={turn}
          participants={participants}
          childrenByParent={childrenByParent}
          depth={0}
        />
      ))}
      <div className="pt-2 text-center">
        <a
          href={`/api/matters/${matterId}/transcript?fmt=jsonl`}
          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          download
        >
          Download JSONL transcript
        </a>
      </div>
    </div>
  );
}

function TurnCard({
  turn,
  participants,
  childrenByParent,
  depth,
}: {
  turn: TranscriptTurn;
  participants: Record<ParticipantId, Participant>;
  childrenByParent: Map<string, TranscriptTurn[]>;
  depth: number;
}) {
  const participant = participants[turn.from] ?? FALLBACK_PARTICIPANT;
  const color: ParticipantColor = participant.color;
  const isUser = turn.from === "user";
  const kids = childrenByParent.get(turn.id) ?? [];

  return (
    <div
      className="relative"
      style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}
    >
      {depth > 0 && (
        <div
          aria-hidden
          className="absolute left-[-10px] top-0 h-full w-px bg-neutral-200 dark:bg-neutral-800"
        />
      )}
      <div
        className={`rounded-lg border ${isUser ? "border-neutral-300 dark:border-neutral-700" : "border-neutral-200 dark:border-neutral-800"} p-3`}
      >
        <div className="flex items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-2">
            <AgentPill
              name={participant.name}
              color={color}
              initials={participant.initials}
              status={turn.kind === "judge-verdict" ? "online" : isUser ? "offline" : "online"}
            />
            {turn.round !== undefined && (
              <span className="text-[10px] text-neutral-400">R{turn.round}</span>
            )}
            {turn.verdict && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${VERDICT_STYLE[turn.verdict] ?? ""}`}
              >
                {turn.verdict}
              </span>
            )}
          </div>
          <time className="text-[10px] text-neutral-400">
            {new Date(turn.createdAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
        </div>
        <div className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-200">
          {turn.content}
        </div>
        {turn.toolCalls && turn.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {turn.toolCalls.map((tc) => (
              <span
                key={tc.id}
                className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                title={JSON.stringify(tc.args, null, 2)}
              >
                {tc.tool}
              </span>
            ))}
          </div>
        )}
      </div>
      {kids.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 pl-5">
          {kids.map((kid) => (
            <TurnCard
              key={kid.id}
              turn={kid}
              participants={participants}
              childrenByParent={childrenByParent}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
