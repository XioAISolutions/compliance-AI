"use client";

/**
 * Chat drawer — opened from the output pane for refinement questions.
 *
 * Chat is demoted to a drawer, not the centerpiece. Used for:
 *   - "Refine this paragraph"
 *   - "Why did you cite this rule?"
 *   - "Expand on the KYC gap"
 */

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  matterId: string;
}

export function ChatDrawer({ open, onClose, matterId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    setStreaming(true);

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch(`/api/matters/${matterId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          if (!raw.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(raw.slice(6)) as { type: string; delta?: string };
            if (event.type === "text-delta" && event.delta) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  last.content += event.delta;
                }
                return next;
              });
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.content = `Error: ${errorMsg}`;
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-sm font-semibold">Refine</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-neutral-400">
            Ask a follow-up about the review output — refine a section, question a citation, or request an expansion.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              }`}
            >
              <span className="whitespace-pre-wrap">{msg.content || "…"}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-neutral-200 p-3 dark:border-neutral-800"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={streaming}
            placeholder="Refine the output…"
            className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-xs focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
          />
          <button
            type="submit"
            disabled={!draft.trim() || streaming}
            className="rounded-md bg-neutral-900 px-3 py-2 text-xs text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
