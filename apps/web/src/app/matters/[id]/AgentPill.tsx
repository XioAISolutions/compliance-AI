"use client";

/**
 * AgentPill — colored identity chip for a participant.
 *
 * Cannibalized from agentchattr's colored @mention pills, with tailwind
 * utility classes instead of inline CSS. The color map lives here so the
 * rest of the UI can ask for a pill by participant id and get consistent
 * styling.
 */

import type { ParticipantColor, ParticipantStatus } from "@compliance-ai/chat-structure";

interface Props {
  name: string;
  color: ParticipantColor;
  initials?: string;
  status?: ParticipantStatus;
  size?: "xs" | "sm";
}

const COLOR_CLASSES: Record<ParticipantColor, { bg: string; text: string; ring: string; dot: string }> = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/40",       text: "text-blue-700 dark:text-blue-300",     ring: "ring-blue-200 dark:ring-blue-800",     dot: "bg-blue-500" },
  amber:  { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-700 dark:text-amber-300",   ring: "ring-amber-200 dark:ring-amber-800",   dot: "bg-amber-500" },
  teal:   { bg: "bg-teal-50 dark:bg-teal-950/40",       text: "text-teal-700 dark:text-teal-300",     ring: "ring-teal-200 dark:ring-teal-800",     dot: "bg-teal-500" },
  green:  { bg: "bg-green-50 dark:bg-green-950/40",     text: "text-green-700 dark:text-green-300",   ring: "ring-green-200 dark:ring-green-800",   dot: "bg-green-500" },
  red:    { bg: "bg-red-50 dark:bg-red-950/40",         text: "text-red-700 dark:text-red-300",       ring: "ring-red-200 dark:ring-red-800",       dot: "bg-red-500" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/40",   text: "text-purple-700 dark:text-purple-300", ring: "ring-purple-200 dark:ring-purple-800", dot: "bg-purple-500" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/40",   text: "text-orange-700 dark:text-orange-300", ring: "ring-orange-200 dark:ring-orange-800", dot: "bg-orange-500" },
  slate:  { bg: "bg-slate-100 dark:bg-slate-800",        text: "text-slate-700 dark:text-slate-300",   ring: "ring-slate-300 dark:ring-slate-700",   dot: "bg-slate-500" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/40",   text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-200 dark:ring-violet-800", dot: "bg-violet-500" },
  pink:   { bg: "bg-pink-50 dark:bg-pink-950/40",       text: "text-pink-700 dark:text-pink-300",     ring: "ring-pink-200 dark:ring-pink-800",     dot: "bg-pink-500" },
};

const STATUS_DOT: Record<ParticipantStatus, string> = {
  online: "bg-green-500",
  working: "bg-amber-500 animate-pulse",
  offline: "bg-neutral-400",
};

export function AgentPill({ name, color, initials, status, size = "sm" }: Props) {
  const c = COLOR_CLASSES[color];
  const sz = size === "xs"
    ? "px-1.5 py-0.5 text-[10px] gap-1"
    : "px-2 py-0.5 text-xs gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ${c.bg} ${c.text} ${c.ring} ${sz}`}
      title={name}
    >
      {initials && (
        <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white ${c.dot}`}>
          {initials.slice(0, 2)}
        </span>
      )}
      <span>{name}</span>
      {status && (
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      )}
    </span>
  );
}
